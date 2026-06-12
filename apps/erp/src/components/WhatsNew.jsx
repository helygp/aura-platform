/**
 * components/WhatsNew.jsx
 *
 * Drawer/modal de "Novidades" — exibe o changelog público (changelog.json).
 *
 * Hook: useChangelog()
 *   - Faz fetch de /changelog.json
 *   - Calcula `hasUnseen` comparando current com localStorage
 *   - Expõe markSeen() para limpar o badge
 *
 * Componente: <WhatsNew open onClose />
 *   - Drawer lateral à direita, mobile fullscreen
 *   - Timeline vertical: cada release com versão, data e highlights
 *   - Ao montar com open=true, dispara markSeen automaticamente
 *
 * Botão sugerido: <WhatsNewButton /> no header
 */

import React, { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Sparkles, Bell } from 'lucide-react'

const STORAGE_KEY = 'aura-changelog-seen'

/* ── Hook ── */
export function useChangelog() {
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [seen,     setSeen]     = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || '' } catch { return '' }
  })

  useEffect(() => {
    fetch('/changelog.json', { cache: 'no-cache' })
      .then(r => r.ok ? r.json() : null)
      .then(j => setData(j))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const markSeen = useCallback(() => {
    if (!data?.current) return
    try { localStorage.setItem(STORAGE_KEY, data.current) } catch {}
    setSeen(data.current)
  }, [data])

  const hasUnseen = Boolean(data?.current && data.current !== seen)

  return { data, loading, hasUnseen, markSeen, current: data?.current ?? null }
}

/* ── Formatador de data PT-BR ── */
function fmtDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  if (!y || !m || !d) return iso
  return `${d} de ${months[m - 1]} de ${y}`
}

/* ── Drawer principal ── */
export function WhatsNew({ open, onClose }) {
  const { data, loading, markSeen, current } = useChangelog()

  /* Marca como visto ao abrir */
  useEffect(() => {
    if (open) markSeen()
  }, [open, markSeen])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="
              fixed inset-y-0 right-0 z-50
              w-full md:w-[440px]
              flex flex-col
              bg-[var(--color-bg)]
              border-l border-[var(--color-border)]
              shadow-2xl
            "
          >
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4 border-b border-[var(--color-border)] shrink-0">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
                <Sparkles size={18} className="text-[var(--color-primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-[var(--color-text)]">Novidades</h2>
                {current && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Versão atual <span className="font-mono font-semibold">v{current}</span>
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loading && (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Carregando…</p>
              )}

              {!loading && !data && (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
                  Não foi possível carregar as novidades.
                </p>
              )}

              {!loading && data?.releases?.length > 0 && (
                <ul className="space-y-6">
                  {data.releases.map((release, i) => (
                    <li key={release.version} className="relative pl-5">
                      {/* Linha vertical da timeline */}
                      {i < data.releases.length - 1 && (
                        <span className="absolute left-[5px] top-3 bottom-[-24px] w-px bg-[var(--color-border)]" />
                      )}
                      {/* Ponto da timeline */}
                      <span
                        className={`
                          absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full
                          ${i === 0
                            ? 'bg-[var(--color-primary)] ring-4 ring-[var(--color-primary)]/20'
                            : 'bg-[var(--color-border)]'}
                        `}
                      />
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-sm font-bold text-[var(--color-text)] font-mono">
                          v{release.version}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)]">·</span>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {fmtDate(release.date)}
                        </span>
                      </div>
                      {release.title && (
                        <p className="text-sm font-medium text-[var(--color-text)] mb-2">
                          {release.title}
                        </p>
                      )}
                      <ul className="space-y-1.5">
                        {(release.highlights ?? []).map((h, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-[var(--color-text-muted)]">
                            <span className="text-base leading-none mt-0.5 shrink-0">{h.icon ?? '•'}</span>
                            <span>{h.text}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)] shrink-0">
              <p className="text-[10px] text-[var(--color-text-muted)] text-center">
                Aura Platform · obrigado por usar a plataforma 💙
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

/* ── Botão pra header (com badge de "Novo") ── */
export function WhatsNewButton() {
  const [open, setOpen] = useState(false)
  const { hasUnseen, current } = useChangelog()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Novidades"
        title="Novidades"
        className="
          relative flex items-center justify-center
          w-9 h-9 rounded-lg
          text-[var(--color-text-secondary)]
          hover:bg-[var(--color-surface-hover)]
          transition-colors duration-150
        "
      >
        <Bell size={18} />
        {hasUnseen && (
          <span
            className="
              absolute top-1.5 right-1.5
              w-2 h-2 rounded-full
              bg-[var(--color-primary)]
              ring-2 ring-[var(--color-surface)]
            "
          />
        )}
      </button>
      <WhatsNew open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/* ── Badge simples da versão (para sidebar footer) ── */
export function VersionBadge({ className = '' }) {
  const { current } = useChangelog()
  /* Fallback: lê da global injetada pelo Vite */
  const version = current || (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '')
  if (!version) return null
  return (
    <span className={`text-[10px] font-mono text-[var(--color-text-tertiary)] ${className}`}>
      v{version}
    </span>
  )
}
