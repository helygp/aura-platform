/**
 * routes/productsImport.js
 *
 * POST /api/products/import
 * Recebe array de linhas parseadas do CSV/Excel e insere/atualiza produtos + SKUs.
 *
 * Colunas esperadas (case-insensitive, aceitam variações em PT/EN):
 *   nome | name
 *   codigo | code | sku
 *   categoria | category
 *   tipo | type          → simples | variante  (default: simples)
 *   preco | price | preco_atacado | price_wholesale
 *   estoque | stock
 *   estoque_minimo | stock_min | min_stock
 *   variacao_1_nome | attr1_name   (ex: Tamanho)
 *   variacao_1_valor | attr1_value  (ex: P)
 *   variacao_2_nome | attr2_name
 *   variacao_2_valor | attr2_value
 */

import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import { query }        from '../lib/tenantDb.js'
import { autoSlug }     from './productAttributes.js'

export const productsImportRouter = Router()
productsImportRouter.use(authenticate)
productsImportRouter.use(authorize('admin'))

/* ── normaliza nome de coluna ── */
function col(headers, ...candidates) {
  for (const c of candidates) {
    const found = headers.find(h => h.toLowerCase().trim() === c.toLowerCase())
    if (found) return found
  }
  return null
}

function val(row, key) {
  if (!key) return ''
  return (row[key] ?? '').toString().trim()
}

function toDecimal(v) {
  if (!v) return 0
  return parseFloat(v.toString().replace(',', '.')) || 0
}

function toInt(v) {
  if (!v) return 0
  return parseInt(v, 10) || 0
}

/* ── POST /api/products/import ── */
productsImportRouter.post('/', async (req, res) => {
  try {
    const { rows } = req.body   // array de objetos {coluna: valor}
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Nenhuma linha recebida.' })
    }
    if (rows.length > 2000) {
      return res.status(400).json({ error: 'Máximo de 2.000 linhas por importação.' })
    }

    const headers = Object.keys(rows[0])

    // Mapear colunas
    const C = {
      nome:    col(headers, 'nome', 'name', 'produto', 'product'),
      codigo:  col(headers, 'codigo', 'código', 'code', 'sku', 'referencia', 'referência', 'ref'),
      cat:     col(headers, 'categoria', 'category', 'cat'),
      tipo:    col(headers, 'tipo', 'type'),
      preco:   col(headers, 'preco', 'preço', 'price', 'preco_atacado', 'preço_atacado', 'price_wholesale', 'valor', 'value'),
      estoque: col(headers, 'estoque', 'stock', 'qty', 'quantidade'),
      min:     col(headers, 'estoque_minimo', 'estoque_mínimo', 'stock_min', 'min_stock', 'minimo', 'mínimo'),
      a1n:     col(headers, 'variacao_1_nome', 'variação_1_nome', 'attr1_name', 'atributo1', 'atributo_1'),
      a1v:     col(headers, 'variacao_1_valor', 'variação_1_valor', 'attr1_value', 'valor1', 'valor_1'),
      a2n:     col(headers, 'variacao_2_nome', 'variação_2_nome', 'attr2_name', 'atributo2', 'atributo_2'),
      a2v:     col(headers, 'variacao_2_valor', 'variação_2_valor', 'attr2_value', 'valor2', 'valor_2'),
    }

    if (!C.nome && !C.codigo) {
      return res.status(400).json({
        error: 'Planilha precisa ter ao menos as colunas "nome" e "codigo" (ou equivalentes em inglês).',
        headersFound: headers,
      })
    }

    const results = { inserted: 0, updated: 0, skipped: 0, errors: [] }

    /* ── Coleta e registra atributos novos no domínio ── */
    const attrCollector = new Map()
    for (const row of rows) {
      const a1n = val(row, C.a1n); const a1v = val(row, C.a1v)
      const a2n = val(row, C.a2n); const a2v = val(row, C.a2v)
      if (a1n && a1v) { if (!attrCollector.has(a1n)) attrCollector.set(a1n, new Set()); attrCollector.get(a1n).add(a1v) }
      if (a2n && a2v) { if (!attrCollector.has(a2n)) attrCollector.set(a2n, new Set()); attrCollector.get(a2n).add(a2v) }
    }
    for (const [attrName, valSet] of attrCollector) {
      try {
        const { rows: existing } = await query(
          'SELECT id, values FROM product_attribute_defs WHERE name = ', [attrName]
        )
        const existingValues = existing[0]?.values ?? []
        const existingLabels = new Set(existingValues.map(v => v.label))
        const merged = [...existingValues]
        for (const v of valSet) {
          if (!existingLabels.has(v)) merged.push({ label: v, slug: autoSlug(v) })
        }
        if (existing[0]) {
          await query(
            'UPDATE product_attribute_defs SET values=::jsonb, updated_at=now() WHERE id=',
            [JSON.stringify(merged), existing[0].id]
          )
        } else {
          await query(
            'INSERT INTO product_attribute_defs (name, values) VALUES (, ::jsonb)',
            [attrName, JSON.stringify(Array.from(valSet).map(v => ({ label: v, slug: autoSlug(v) })))]
          )
        }
      } catch (_) { /* não bloqueia importação por falha no domínio */ }
    }

    /* ── Pré-processar: agrupar variantes pelo nome do produto ── */
    // Para variantes: mesmo nome = mesmo produto pai.
    // O 'codigo' da planilha vira código do SKU.
    // O código do produto pai = primeiro segmento do codigo (ex: C001 de C001-02-PT)
    //   ou o proprio codigo se não houver traço.
    const prodGroups = new Map() // nome+categoria → { code, nome, categoria, tipo, linhas[] }

    for (let i = 0; i < rows.length; i++) {
      const row     = rows[i]
      const lineNum = i + 2
      const nome    = val(row, C.nome)
      const codigo  = val(row, C.codigo) || nome.toLowerCase().replace(/\s+/g, '-').slice(0, 30)
      if (!nome) {
        results.errors.push({ linha: lineNum, erro: 'Nome do produto obrigatório.' })
        results.skipped++; continue
      }
      const tipoRaw  = val(row, C.tipo).toLowerCase()
      const tipo     = tipoRaw.includes('var') || tipoRaw.includes('grade') ? 'variante' : 'simples'
      const categoria = val(row, C.cat) || 'Geral'

      // Código base do produto: primeiro segmento do codigo (para variantes)
      const baseCode = tipo === 'variante'
        ? (codigo.includes('-') ? codigo.split('-')[0] : codigo)
        : codigo

      const groupKey = `${nome}|${baseCode}`
      if (!prodGroups.has(groupKey)) {
        prodGroups.set(groupKey, { baseCode, nome, categoria, tipo, linhas: [] })
      }
      prodGroups.get(groupKey).linhas.push({ row, lineNum, codigo, tipo })
    }

    /* ── Processar grupos ── */
    for (const [, group] of prodGroups) {
      const { baseCode, nome, categoria, tipo } = group

      try {
        // Upsert produto pai
        const prodResult = await query(`
          INSERT INTO products (id, name, code, category, type, attributes, created_at, updated_at)
          VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, now(), now())
          ON CONFLICT (code) DO UPDATE
            SET name=EXCLUDED.name, category=EXCLUDED.category,
                type=EXCLUDED.type, updated_at=now()
          RETURNING id, (xmax = 0) AS inserted
        `, [nome, baseCode, categoria, tipo, JSON.stringify([])])

        const prodId    = prodResult.rows[0].id
        const wasInsert = prodResult.rows[0].inserted
        if (wasInsert) results.inserted++; else results.updated++

        // Upsert SKUs do grupo
        for (const { row, lineNum, codigo } of group.linhas) {
          const preco    = toDecimal(val(row, C.preco))
          const estoque  = toInt(val(row, C.estoque))
          const stockMin = toInt(val(row, C.min))
          const a1n = val(row, C.a1n); const a1v = val(row, C.a1v)
          const a2n = val(row, C.a2n); const a2v = val(row, C.a2v)
          const attrs = {}
          if (a1n && a1v) attrs[a1n] = a1v
          if (a2n && a2v) attrs[a2n] = a2v

          // skuCode = codigo da planilha (já é o código único do SKU)
          // Para simples sem atributos: usa o proprio baseCode
          const skuCode = tipo === 'simples' ? baseCode : codigo

          try {
            await query(`
              INSERT INTO skus (id, product_id, code, attributes, price_wholesale, stock, stock_min, created_at, updated_at)
              VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, now(), now())
              ON CONFLICT (code) DO UPDATE
                SET price_wholesale=EXCLUDED.price_wholesale,
                    stock=EXCLUDED.stock, stock_min=EXCLUDED.stock_min,
                    product_id=EXCLUDED.product_id, updated_at=now()
            `, [prodId, skuCode, JSON.stringify(attrs), preco, estoque, stockMin])
          } catch (e) {
            results.errors.push({ linha: lineNum, nome, codigo, erro: e.message })
            results.skipped++
          }
        }
      } catch (e) {
        group.linhas.forEach(({ lineNum }) =>
          results.errors.push({ linha: lineNum, nome, erro: e.message })
        )
        results.skipped += group.linhas.length
      }
    }

    res.json({
      ok:       true,
      total:    rows.length,
      inserted: results.inserted,
      updated:  results.updated,
      skipped:  results.skipped,
      errors:   results.errors.slice(0, 50),   // máx 50 erros no response
    })

  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
