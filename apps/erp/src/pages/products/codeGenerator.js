/**
 * pages/products/codeGenerator.js
 *
 * Geração canônica de códigos:
 *   • slugFor(attrName, label, attrDefs)  — slug a partir do cadastro de atributos
 *   • buildSkuCode(productCode, attrs, attrDefs, orderedAttrNames)
 *   • derivePrefix(categoryName)          — fallback de prefixo (1ª letra)
 *   • buildProductCode(prefix, sequential)
 *   • defaultSlug(value)                  — fallback quando label não está cadastrado
 *
 * Convenções (validadas com dados reais):
 *   - Produto:  {LETRA_CATEGORIA}{SEQ_3}        ex. M001
 *   - SKU:      {PRODUTO}-{TOKEN1}-{TOKEN2}...  ex. M001-02-AZB
 *   - Token preferencial vem de product_attribute_defs.values[].slug
 *   - Token fallback (label não cadastrado):
 *       número  → padStart(2,'0')   (2 → "02", 10 → "10")
 *       palavra única → 2 primeiras letras upper (Branco → BR)
 *       multi-palavra → iniciais das palavras upper (Azul Bic → AB)
 */

/* ── Helpers internos ── */

function _normalize(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/* ── Fallback automático: gera slug se o label não estiver cadastrado ── */
export function defaultSlug(value) {
  const s = _normalize(value)
  if (!s) return ''
  // Apenas dígitos? padding pra 2
  if (/^[0-9]+$/.test(s)) return s.padStart(2, '0')
  // Letras curtas (PP, GG)? mantém upper
  if (/^[A-Za-z]+$/.test(s) && s.length <= 4) return s.toUpperCase()
  // Multi-palavra? iniciais
  const words = s.split(/\s+/).filter(Boolean)
  if (words.length > 1) {
    return words.map(w => w[0]).join('').toUpperCase().slice(0, 4)
  }
  // Palavra única? 2 primeiras
  return s.slice(0, 2).toUpperCase()
}

/* ── Slug a partir do cadastro, com fallback ── */
export function slugFor(attrName, label, attrDefs) {
  const lookup = _normalize(label).toLowerCase()
  if (Array.isArray(attrDefs)) {
    const def = attrDefs.find(d => _normalize(d.name).toLowerCase() === _normalize(attrName).toLowerCase())
    if (def?.values?.length) {
      const hit = def.values.find(v => _normalize(v.label).toLowerCase() === lookup)
      if (hit?.slug) return hit.slug
    }
  }
  return defaultSlug(label)
}

/* ── Indica se o slug usado é fallback (label não está no cadastro) ── */
export function isSlugFallback(attrName, label, attrDefs) {
  if (!Array.isArray(attrDefs)) return true
  const def = attrDefs.find(d => _normalize(d.name).toLowerCase() === _normalize(attrName).toLowerCase())
  if (!def?.values?.length) return true
  const lookup = _normalize(label).toLowerCase()
  return !def.values.some(v => _normalize(v.label).toLowerCase() === lookup)
}

/* ── Código completo do SKU ──
 *  attrs           : { Cor: "Azul Bic", Tamanho: "2" }
 *  attrDefs        : lista vinda de GET /api/product-attributes
 *  orderedAttrNames: ordem desejada dos tokens (ex: ['Tamanho', 'Cor'])
 *                    se omitido, usa Object.keys(attrs)
 */
export function buildSkuCode(productCode, attrs, attrDefs, orderedAttrNames) {
  const order = Array.isArray(orderedAttrNames) && orderedAttrNames.length
    ? orderedAttrNames
    : Object.keys(attrs ?? {})
  const tokens = order
    .map(name => slugFor(name, attrs?.[name], attrDefs))
    .filter(Boolean)
  return `${productCode}-${tokens.join('-')}`
}

/* ── Prefixo de categoria (1ª letra ASCII, upper) ── */
export function derivePrefix(categoryName) {
  const s = _normalize(categoryName)
  const ch = s.charAt(0).toUpperCase()
  return /[A-Z]/.test(ch) ? ch : 'X'
}

/* ── Código do produto a partir do prefixo e sequencial ── */
export function buildProductCode(prefix, sequential) {
  const n = Math.max(1, parseInt(sequential) || 1)
  return `${prefix}${String(n).padStart(3, '0')}`
}
