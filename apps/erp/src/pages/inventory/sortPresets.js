/**
 * pages/inventory/sortPresets.js
 *
 * Ordenação multi-chave de SKUs no estoque com presets selecionáveis.
 *
 * Cada SKU tem:
 *   { code, productName, productCode, stock, stockMin, status,
 *     attributes: { Cor?: 'Amarelo', Tamanho?: '2' | 'M' | ... } }
 */

/* Ordem canônica de letras de tamanho. */
const SIZE_LETTER_ORDER = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG']

/* Compara strings em pt-BR ignorando acentos e case. */
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: false })

/**
 * Compara tamanhos com lógica mista:
 *   - Numérico → ordem numérica (1 < 2 < 10)
 *   - Letras conhecidas (PP, P, M, G, GG, XG) → ordem definida
 *   - Outros → alfabético
 *   - Vazios sempre por último
 */
export function compareSize(a, b) {
  const sa = a == null ? '' : String(a).trim()
  const sb = b == null ? '' : String(b).trim()
  if (!sa && !sb) return 0
  if (!sa) return 1
  if (!sb) return -1

  const na = Number(sa)
  const nb = Number(sb)
  const aIsNum = !isNaN(na)
  const bIsNum = !isNaN(nb)

  if (aIsNum && bIsNum) return na - nb
  if (aIsNum) return -1  // números antes de letras
  if (bIsNum) return 1

  const ia = SIZE_LETTER_ORDER.indexOf(sa.toUpperCase())
  const ib = SIZE_LETTER_ORDER.indexOf(sb.toUpperCase())
  if (ia !== -1 && ib !== -1) return ia - ib
  if (ia !== -1) return -1
  if (ib !== -1) return 1

  return collator.compare(sa, sb)
}

/* Compara cores: alfabético pt-BR, vazios por último. */
export function compareColor(a, b) {
  const sa = a == null ? '' : String(a).trim()
  const sb = b == null ? '' : String(b).trim()
  if (!sa && !sb) return 0
  if (!sa) return 1
  if (!sb) return -1
  return collator.compare(sa, sb)
}

/* Compara strings genéricas com locale. Vazios por último. */
function compareText(a, b) {
  const sa = a == null ? '' : String(a).trim()
  const sb = b == null ? '' : String(b).trim()
  if (!sa && !sb) return 0
  if (!sa) return 1
  if (!sb) return -1
  return collator.compare(sa, sb)
}

/* Status do estoque: critico → baixo → normal. */
const STATUS_ORDER = { critico: 0, baixo: 1, normal: 2 }
function compareStatus(a, b) {
  const va = STATUS_ORDER[a] ?? 99
  const vb = STATUS_ORDER[b] ?? 99
  return va - vb
}

/* Helpers de acesso */
const colorOf = (sku) => sku.attributes?.Cor ?? sku.attributes?.cor ?? ''
const sizeOf  = (sku) => sku.attributes?.Tamanho ?? sku.attributes?.tamanho ?? ''

/* Lista de presets ─── cada um exporta {key, label, compare(a, b)} */
export const SORT_PRESETS = [
  {
    key: 'produto-cor-tamanho',
    label: 'Produto · Cor · Tamanho',
    compare: (a, b) =>
      compareText(a.productName, b.productName) ||
      compareColor(colorOf(a), colorOf(b)) ||
      compareSize(sizeOf(a), sizeOf(b)) ||
      compareText(a.code, b.code),
  },
  {
    key: 'produto-tamanho-cor',
    label: 'Produto · Tamanho · Cor',
    compare: (a, b) =>
      compareText(a.productName, b.productName) ||
      compareSize(sizeOf(a), sizeOf(b)) ||
      compareColor(colorOf(a), colorOf(b)) ||
      compareText(a.code, b.code),
  },
  {
    key: 'codigo',
    label: 'Código (A → Z)',
    compare: (a, b) => compareText(a.code, b.code),
  },
  {
    key: 'estoque-menor',
    label: 'Estoque (menor primeiro)',
    compare: (a, b) =>
      (Number(a.stock) || 0) - (Number(b.stock) || 0) ||
      compareText(a.productName, b.productName) ||
      compareText(a.code, b.code),
  },
  {
    key: 'estoque-maior',
    label: 'Estoque (maior primeiro)',
    compare: (a, b) =>
      (Number(b.stock) || 0) - (Number(a.stock) || 0) ||
      compareText(a.productName, b.productName) ||
      compareText(a.code, b.code),
  },
  {
    key: 'status',
    label: 'Status (crítico primeiro)',
    compare: (a, b) =>
      compareStatus(a.status, b.status) ||
      compareText(a.productName, b.productName) ||
      compareText(a.code, b.code),
  },
]

export const DEFAULT_PRESET = 'produto-cor-tamanho'

/* Mapa rápido por key */
const PRESET_MAP = SORT_PRESETS.reduce((m, p) => (m[p.key] = p, m), {})

/* Aplica o preset à lista de skus, sem mutar o original. */
export function sortSkusByPreset(skus, presetKey) {
  if (!skus?.length) return skus ?? []
  const preset = PRESET_MAP[presetKey] ?? PRESET_MAP[DEFAULT_PRESET]
  return [...skus].sort(preset.compare)
}

/* localStorage helpers */
const LS_KEY = 'aura-inventory-sort'

export function loadPresetPreference() {
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v && PRESET_MAP[v]) return v
  } catch {}
  return DEFAULT_PRESET
}

export function savePresetPreference(key) {
  try { localStorage.setItem(LS_KEY, key) } catch {}
}
