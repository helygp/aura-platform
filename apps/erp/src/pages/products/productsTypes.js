/**
 * pages/products/productsTypes.js
 *
 * Constantes e helpers de domínio para o módulo de produtos.
 * Sem dependências de framework — pode ser importado em qualquer lugar.
 */

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
 * @param {string} baseCode  — código base do produto pai
 * @param {Array}  attributes — [{ name, values: string[] }]
 * @returns Array de objetos SKU
 */
export function generateSkus(baseCode, attributes) {
  const filled = attributes.filter(a => a.name && a.values?.length > 0)
  if (!filled.length) return []

  const combos = cartesian(filled.map(a => a.values))

  return combos.map((combo, i) => {
    const attrs = {}
    filled.forEach((a, j) => { attrs[a.name] = combo[j] })

    const suffix = combo.map(v => v.replace(/\s+/g, '').toUpperCase().slice(0, 3)).join('-')
    return {
      _tempId:       `sku-${i}`,
      code:          `${baseCode}-${suffix}`,
      attributes:    attrs,
      priceWholesale: '',
      stock:         0,
      stockMin:      0,
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


/* ─── Gera sigla automática para valor de atributo ─── */
export function generateValueSlug(label) {
  if (!label) return ''
  const normalized = label.normalize('NFD').replace(/[̀-ͯ]/g, '')
  const words = normalized.trim().split(/s+/)
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase()
  return words.map(w => w[0] || '').join('').toUpperCase().slice(0, 3)
}
/* ─── Formata preço BRL ─── */
export const fmtBRL = (v) =>
  v == null || v === ''
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
