'use client'
/**
 * components/product/GradeMatrix.tsx
 * Star feature da loja B2B.
 *
 * Tabela cor × tamanho onde o lojista define quantidades por célula.
 * Grade fechada: botão que preenche todos os tamanhos com a proporção padrão.
 * Tiers de desconto: calculado em tempo real sobre o total de peças.
 */

import { useState, useMemo, useCallback } from 'react'
import type { TenantTheme, VolumeTier } from '@/lib/tenant'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface MatrixEntry {
  /** chave: `${productId}__${color}__${size}` */
  key:   string
  color: string
  size:  string
  qty:   number
}

interface Props {
  productId:    string
  productName:  string
  price:        number
  colors:       string[]         // ex: ['Preto', 'Branco', 'Bordo']
  colorHexMap:  Record<string, string>  // ex: { 'Preto': '#1a1a1a', ... }
  sizes:        string[]         // ex: ['PP','P','M','G','GG'] ou ['2','4','6'...]
  gradeTemplate: Record<string, number> // ex: { 'PP':1,'P':2,'M':3,'G':3,'GG':2 }
  gradeFechada: boolean
  showSkuCode:  boolean
  volumeTiers:  VolumeTier[]
  minOrder:     number
  theme:        TenantTheme
  onAddToCart:  (items: MatrixEntry[]) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brl(n: number) { n = n / 100;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function tierFor(pieces: number, tiers: VolumeTier[]) {
  let cur = tiers[0] ?? { min: 0, off: 0 }
  let next: VolumeTier | null = null
  for (const t of tiers) {
    if (pieces >= t.min) cur = t
  }
  next = tiers.find(t => t.min > pieces) ?? null
  return { cur, next }
}

function isLightHex(hex: string) {
  const n = hex.replace('#', '')
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 160
}

// ─── Stepper célula ───────────────────────────────────────────────────────────

function CellStepper({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
      overflow: 'hidden', height: 34, fontSize: 13,
    }}>
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        style={{
          width: 28, height: '100%', background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--ink-2)', fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >−</button>
      <input
        type="number"
        min={0}
        value={value || ''}
        placeholder="0"
        onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        style={{
          width: 34, height: '100%', border: 'none', textAlign: 'center',
          fontSize: 13, fontWeight: value > 0 ? 600 : 400,
          color: value > 0 ? 'var(--ink)' : 'var(--muted)',
          background: value > 0 ? 'var(--brand-soft)' : 'transparent',
          outline: 'none',
        }}
      />
      <button
        onClick={() => onChange(value + 1)}
        style={{
          width: 28, height: '100%', background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--ink-2)', fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >+</button>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function GradeMatrix({
  productId,
  productName,
  price,
  colors,
  colorHexMap,
  sizes,
  gradeTemplate,
  gradeFechada,
  showSkuCode,
  volumeTiers,
  minOrder,
  theme,
  onAddToCart,
}: Props) {
  // matrix[color][size] = qty
  const [matrix, setMatrix] = useState<Record<string, Record<string, number>>>({})
  const [selectedColors, setSelectedColors] = useState<string[]>(colors.slice(0, 2))

  const setCell = useCallback((color: string, size: string, qty: number) => {
    setMatrix(m => ({
      ...m,
      [color]: { ...(m[color] ?? {}), [size]: Math.max(0, qty) },
    }))
  }, [])

  const fillGrade = useCallback((color: string) => {
    setMatrix(m => ({ ...m, [color]: { ...gradeTemplate } }))
  }, [gradeTemplate])

  const fillAll = useCallback(() => {
    const m: Record<string, Record<string, number>> = {}
    selectedColors.forEach(c => { m[c] = { ...gradeTemplate } })
    setMatrix(m)
  }, [selectedColors, gradeTemplate])

  const clearAll = useCallback(() => setMatrix({}), [])

  const toggleColor = (color: string) => {
    setSelectedColors(s =>
      s.includes(color) ? s.filter(c => c !== color) : [...s, color]
    )
  }

  // Totais
  const colorTotal  = (c: string) => sizes.reduce((s, sz) => s + (matrix[c]?.[sz] || 0), 0)
  const sizeTotal   = (sz: string) => selectedColors.reduce((s, c) => s + (matrix[c]?.[sz] || 0), 0)
  const totalPieces = useMemo(
    () => selectedColors.reduce((s, c) => s + colorTotal(c), 0),
    [matrix, selectedColors],
  )
  const subtotal = totalPieces * price

  const { cur, next } = tierFor(totalPieces, volumeTiers)
  const discount   = subtotal * cur.off
  const totalFinal = subtotal - discount

  const handleAdd = () => {
    if (totalPieces === 0) return
    const items: MatrixEntry[] = []
    selectedColors.forEach(color => {
      sizes.forEach(size => {
        const qty = matrix[color]?.[size] || 0
        if (qty > 0) {
          items.push({ key: `${productId}__${color}__${size}`, color, size, qty })
        }
      })
    })
    onAddToCart(items)
    setMatrix({})
  }

  const gradeMinima = Object.values(gradeTemplate).reduce((s, v) => s + v, 0)

  return (
    <div>
      {/* Título seção */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
          Monte sua grade
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {gradeFechada && (
            <button
              onClick={fillAll}
              style={{
                fontSize: 12.5, fontWeight: 600, padding: '5px 12px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--brand)',
                background: 'var(--brand-soft)', color: 'var(--brand-soft-ink)',
                cursor: 'pointer',
              }}
            >
              ↓ Preencher todas ({gradeMinima} pç/cor)
            </button>
          )}
          {totalPieces > 0 && (
            <button
              onClick={clearAll}
              style={{
                fontSize: 12.5, fontWeight: 600, padding: '5px 12px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)',
                background: 'transparent', color: 'var(--ink-2)',
                cursor: 'pointer',
              }}
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Seletor de cores */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 8 }}>
          Cores ({selectedColors.length} selecionada{selectedColors.length !== 1 ? 's' : ''})
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {colors.map(color => {
            const hex     = colorHexMap[color] ?? '#ccc'
            const active  = selectedColors.includes(color)
            const isLight = isLightHex(hex)
            return (
              <button
                key={color}
                onClick={() => toggleColor(color)}
                title={color}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '5px 10px 5px 7px',
                  borderRadius: 999,
                  border: `1px solid ${active ? 'var(--brand)' : 'var(--line)'}`,
                  background: active ? 'var(--brand-soft)' : 'var(--surface)',
                  cursor: 'pointer',
                  boxShadow: active ? '0 0 0 2px var(--brand-soft)' : 'none',
                  transition: 'all .12s',
                }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: hex, flexShrink: 0,
                  border: isLight ? '1px solid var(--line)' : '1px solid rgba(0,0,0,.1)',
                }} />
                <span style={{ fontSize: 12.5, fontWeight: active ? 600 : 400, color: active ? 'var(--brand-soft-ink)' : 'var(--ink-2)' }}>
                  {color}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {selectedColors.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)', fontSize: 14 }}>
          Selecione pelo menos uma cor para montar a grade.
        </div>
      )}

      {selectedColors.length > 0 && (
        <>
          {/* Tabela */}
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 600, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>
                    Cor
                  </th>
                  {sizes.map(sz => (
                    <th key={sz} style={{ padding: '7px 6px', fontWeight: 600, color: 'var(--ink-2)', fontSize: 12, borderBottom: '1px solid var(--line)', textAlign: 'center', minWidth: 68 }}>
                      {sz}
                    </th>
                  ))}
                  <th style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid var(--line)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    Total
                  </th>
                  {gradeFechada && (
                    <th style={{ padding: '7px 8px', borderBottom: '1px solid var(--line)', width: 32 }} />
                  )}
                </tr>
              </thead>
              <tbody>
                {selectedColors.map((color, ci) => {
                  const hex     = colorHexMap[color] ?? '#ccc'
                  const isLight = isLightHex(hex)
                  const total   = colorTotal(color)
                  return (
                    <tr key={color} style={{ background: ci % 2 === 0 ? 'transparent' : 'var(--surface-2)' }}>
                      {/* Cor */}
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--line-2)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            width: 18, height: 18, borderRadius: '50%',
                            background: hex, flexShrink: 0,
                            border: isLight ? '1px solid var(--line)' : '1px solid rgba(0,0,0,.1)',
                          }} />
                          <span style={{ fontWeight: 500, color: 'var(--ink)', fontSize: 13 }}>{color}</span>
                        </div>
                      </td>
                      {/* Células de quantidade */}
                      {sizes.map(sz => (
                        <td key={sz} style={{ padding: '6px', borderBottom: '1px solid var(--line-2)', textAlign: 'center' }}>
                          <CellStepper
                            value={matrix[color]?.[sz] || 0}
                            onChange={qty => setCell(color, sz, qty)}
                          />
                        </td>
                      ))}
                      {/* Total da cor */}
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--line-2)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: total > 0 ? 700 : 400, color: total > 0 ? 'var(--ink)' : 'var(--muted)', fontSize: 13 }}>
                          {total > 0 ? `${total} pç` : '—'}
                        </span>
                      </td>
                      {/* Preencher grade */}
                      {gradeFechada && (
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--line-2)', textAlign: 'center' }}>
                          <button
                            onClick={() => fillGrade(color)}
                            title={`Preencher grade ${color}`}
                            style={{
                              width: 28, height: 28, borderRadius: 6,
                              border: '1px solid var(--line)', background: 'var(--surface)',
                              cursor: 'pointer', color: 'var(--brand)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 14, fontWeight: 700,
                            }}
                          >↓</button>
                        </td>
                      )}
                    </tr>
                  )
                })}

                {/* Linha de totais por tamanho */}
                <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--line)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    Total
                  </td>
                  {sizes.map(sz => {
                    const t = sizeTotal(sz)
                    return (
                      <td key={sz} style={{ padding: '8px 6px', textAlign: 'center', fontWeight: t > 0 ? 700 : 400, color: t > 0 ? 'var(--ink)' : 'var(--muted)', fontSize: 12 }}>
                        {t > 0 ? t : '—'}
                      </td>
                    )
                  })}
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>
                    {totalPieces > 0 ? `${totalPieces} pç` : '—'}
                  </td>
                  {gradeFechada && <td />}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Tier banner */}
          {volumeTiers.length > 1 && totalPieces > 0 && (
            <TierBanner pieces={totalPieces} tiers={volumeTiers} />
          )}

          {/* Resumo de valor */}
          {totalPieces > 0 && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius)', padding: '16px 18px',
              marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)' }}>
                <span>{totalPieces} peças × {brl(price)}</span>
                <span>{brl(subtotal)}</span>
              </div>
              {cur.off > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--brand-soft-ink)', fontWeight: 600 }}>
                  <span>Desconto {(cur.off * 100).toFixed(0)}% ({totalPieces} pç)</span>
                  <span>− {brl(discount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', borderTop: '1px solid var(--line-2)', paddingTop: 8, marginTop: 2 }}>
                <span style={{ color: 'var(--ink)' }}>Total</span>
                <span style={{ color: cur.off > 0 ? 'var(--brand)' : 'var(--ink)' }}>{brl(totalFinal)}</span>
              </div>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleAdd}
            disabled={totalPieces === 0}
            style={{
              width: '100%', height: 54, borderRadius: 'var(--radius-sm)',
              border: 'none', cursor: totalPieces > 0 ? 'pointer' : 'not-allowed',
              background: totalPieces > 0 ? 'var(--brand)' : 'var(--line)',
              color: totalPieces > 0 ? 'var(--brand-ink)' : 'var(--muted)',
              fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'opacity .15s',
              opacity: totalPieces > 0 ? 1 : 0.6,
            }}
          >
            <CartIcon />
            {totalPieces > 0
              ? `Adicionar ${totalPieces} peças ao carrinho`
              : 'Preencha a grade para continuar'}
          </button>

          {totalPieces > 0 && totalFinal < minOrder && (
            <p style={{ textAlign: 'center', marginTop: 8, fontSize: 12.5, color: 'var(--muted)' }}>
              Pedido mínimo: {brl(minOrder)}. Faltam {brl(minOrder - totalFinal)} para completar.
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ─── TierBanner ───────────────────────────────────────────────────────────────

function TierBanner({ pieces, tiers }: { pieces: number; tiers: VolumeTier[] }) {
  const { cur, next } = tierFor(pieces, tiers)

  return (
    <div style={{
      background: 'var(--brand-soft)', border: '1px solid color-mix(in srgb, var(--brand) 20%, transparent)',
      borderRadius: 'var(--radius-sm)', padding: '10px 14px',
      marginBottom: 14, fontSize: 13,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ color: 'var(--brand-soft-ink)', fontWeight: 600 }}>
          {cur.off > 0
            ? `✓ Desconto de ${(cur.off * 100).toFixed(0)}% ativo`
            : 'Adicione mais peças para desbloquear desconto'}
        </div>
        {next && (
          <div style={{ color: 'var(--brand-soft-ink)', opacity: .8, whiteSpace: 'nowrap', fontSize: 12 }}>
            +{next.min - pieces} pç → {(next.off * 100).toFixed(0)}%
          </div>
        )}
      </div>
      {next && (
        <div style={{ marginTop: 8, height: 4, background: 'rgba(0,0,0,.08)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 999, background: 'var(--brand)',
            width: `${Math.min(100, (pieces / next.min) * 100).toFixed(1)}%`,
            transition: 'width .3s',
          }} />
        </div>
      )}
    </div>
  )
}

// ─── Ícones inline ────────────────────────────────────────────────────────────

function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/>
      <path d="M2 3h2.2l2.3 12.1a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.3L21 7H6"/>
    </svg>
  )
}
