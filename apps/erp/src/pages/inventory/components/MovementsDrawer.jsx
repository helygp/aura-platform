/**
 * pages/inventory/components/MovementsDrawer.jsx
 *
 * Painel lateral (sheet) com histórico de movimentações de um SKU.
 * Abre sobre o conteúdo da página a partir da direita.
 * Em mobile ocupa tela inteira; em desktop fica em 400px.
 *
 * Props:
 *   sku        : objeto SKU (null = fechado)
 *   movements  : array de movimentos
 *   onClose    : fn
 *   onNew      : fn  — abre modal de nova movimentação
 */

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, Package } from 'lucide-react'
import { Button } from '@aura/ui'
import { MOVEMENT_TYPES, MOVEMENT_LABELS, fmtDate } from '../inventoryTypes.js'

const MOV_ICONS = {
  [MOVEMENT_TYPES.IN]:  ArrowDownToLine,
  [MOVEMENT_TYPES.OUT]: ArrowUpFromLine,
  [MOVEMENT_TYPES.ADJ]: SlidersHorizontal,
}

function MovementRow({ mov }) {
  const meta = MOVEMENT_LABELS[mov.type]
  const Icon = MOV_ICONS[mov.type]
  const sign = mov.type === MOVEMENT_TYPES.IN ? '+' : mov.type === MOVEMENT_TYPES.OUT ? '-' : '='

  return (
    <div className="flex items-start gap-3 py-3 border-b border-[var(--color-border)] last:border-0">
      {/* Ícone */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
        <Icon size={14} className={meta.color} />
      </div>

      {/* Detalhe */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
          <span className={`text-sm font-bold tabular-nums ${meta.color}`}>
            {sign}{mov.qty}
          </span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{mov.reason}</p>
        <p className="text-[10px] text-[var(--color-text-disabled)] mt-0.5">
          {fmtDate(mov.createdAt)} · {mov.user}
        </p>
      </div>
    </div>
  )
}

export function MovementsDrawer({ sku, movements, onClose, onNew }) {
  const attrStr = Object.entries(sku?.attributes ?? {})
    .map(([k, v]) => `${k}: ${v}`).join(' · ')

  return (
    <AnimatePresence>
      {sku && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="
              fixed inset-y-0 right-0 z-50
              w-full md:w-[400px]
              flex flex-col
              bg-[var(--color-bg)] border-l border-[var(--color-border)]
              shadow-2xl
            "
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-4 border-b border-[var(--color-border)] shrink-0">
              <div className="min-w-0">
                <p className="text-xs font-mono text-[var(--color-text-muted)] truncate">{sku?.code}</p>
                <p className="text-sm font-semibold text-[var(--color-text)] mt-0.5 truncate">{sku?.productName}</p>
                {attrStr && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{attrStr}</p>}
              </div>
              <button
                onClick={onClose}
                className="
                  w-8 h-8 flex items-center justify-center rounded-lg shrink-0
                  text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]
                  transition-colors
                "
              >
                <X size={16} />
              </button>
            </div>

            {/* Estoque atual */}
            <div className="flex items-center gap-6 px-4 py-3 bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)] shrink-0">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Estoque atual</p>
                <p className="text-2xl font-bold text-[var(--color-text)]">{sku?.stock ?? 0}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Mínimo</p>
                <p className="text-2xl font-bold text-[var(--color-text-muted)]">{sku?.stockMin ?? 0}</p>
              </div>
              <Button size="sm" onClick={onNew} className="ml-auto">
                <Plus size={14} /> Movimentar
              </Button>
            </div>

            {/* Histórico */}
            <div className="flex-1 overflow-y-auto">
              {movements?.length ? (
                <div className="px-4">
                  {movements.map(mov => (
                    <MovementRow key={mov.id} mov={mov} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
                  <Package size={32} className="text-[var(--color-text-disabled)]" />
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Nenhuma movimentação registrada para este SKU.
                  </p>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
