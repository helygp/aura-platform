/**
 * pages/products/productsTypes.js
 *
 * Constantes e helpers de domínio para o módulo de produtos.
 * Sem dependências de framework — pode ser importado em qualquer lugar.
 */

import { buildSkuCode, defaultSlug } from './codeGenerator.js'

/* ─── Tipo de produto ─── */
export const PRODUCT_TYPES = {
  SIMPLE:  'simples',
  VARIANT: 'variante',
}

/* ─── Status de estoque de SKU ─── */
export const STOCK_STATUS = {
  OK:       'ok',
  LOW:      'baixo',
  ZERO:     'zerado',
}

/* ─── Categorias padrão (tenant pode ter as próprias) ─── */
export const DEFAULT_CATEGORIES = [
  'Calçados', 'Roupas', 'Acessórios', 'Bolsas', 'Esporte',
  'Infantil', 'Outros',
]

/* ─── Atributos padrão para grade ─── */
export const DEFAULT_ATTRIBUTES = ['Cor', 'Tamanho', 'Material', 'Voltagem']

/* ─── Valores padrão por atributo ─── */
export const DEFAULT_ATTRIBUTE_VALUES = {
  Tamanho:   ['PP', 'P', 'M', 'G', 'GG', 'XG'],
  Cor:       ['Preto', 'Branco', 'Azul', 'Vermelho', 'Verde', 'Amarelo', 'Cinza'],
  Material:  ['Couro', 'Tecido', 'Sintético', 'Borracha'],
  Voltagem:  ['110V', '220V', 'Bivolt'],
}

/* ─── Gera todas as combinações de atributos (produto cartesiano) ─── */
export function cartesian(arrays) {
  if (!arrays.length) return []
  return arrays.reduce(
    (acc, arr) => acc.flatMap(a => arr.map(b => [...a, b])),
    [[]]
  )
}

/**
 * Gera SKUs filhos a partir dos atributos configurados.
 * Usa codeGenerator (slugs do cadastro de atributos) com fallback automático.
 *
 * @param {string} baseCode  — código base do produto pai
 * @param {Array}  attributes — [{ name, values: string[] }]
 * @param {Array}  attrDefs   — [{ name, values: [{slug, label}] }] do cadastro (opcional)
 * @returns Array de objetos SKU
 */
export function generateSkus(baseCode, attributes, attrDefs) {
  const filled = attributes.filter(a => a.name && a.values?.length > 0)
  if (!filled.length) return []

  const combos = cartesian(filled.map(a => a.values))
  const orderedNames = filled.map(a => a.name)

  return combos.map((combo, i) => {
    const attrs = {}
    filled.forEach((a, j) => { attrs[a.name] = combo[j] })

    return {
      _tempId:        `sku-${i}`,
      code:           buildSkuCode(baseCode, attrs, attrDefs, orderedNames),
      attributes:     attrs,
      priceWholesale: '',
      stock:          0,
      stockMin:       0,
    }
  })
}

/* ─── Valida form de produto simples ─── */
export function validateSimpleProduct(form) {
  const errors = {}
  if (!form.name?.trim())          errors.name = 'Nome é obrigatório.'
  if (!form.code?.trim())          errors.code = 'Código é obrigatório.'
  if (!form.category)              errors.category = 'Categoria é obrigatória.'
  if (form.priceWholesale !== '' && isNaN(Number(form.priceWholesale)))
    errors.priceWholesale = 'Preço inválido.'
  return errors
}

/* ─── Valida form de produto com grade ─── */
export function validateVariantProduct(form) {
  return validateSimpleProduct(form)
}

/* ─── Gera sigla automática para valor de atributo (compatibilidade) ─── */
export function generateValueSlug(label) {
  return defaultSlug(label)
}

/* ─── Formata preço BRL ─── */
export const fmtBRL = (v) =>
  v == null || v === ''
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
