/** Formatadores globais */

export const fmtBRL = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)

export const fmtNum = (v) =>
  new Intl.NumberFormat('pt-BR').format(v ?? 0)

export const fmtDate = (v) =>
  v ? new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export const fmtPeriod = (v) => {
  if (!v) return '—'
  const [y, m] = v.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
