/**
 * pages/orders/components/StatusBadge.jsx
 *
 * Badge reutilizável de status de pedido com dot colorido.
 */

import React from 'react'
import { STATUS_META } from '../ordersTypes.js'

export function StatusBadge({ status, size = 'md' }) {
  const meta = STATUS_META[status]
  if (!meta) return null

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  }

  return (
    <span className={`
      inline-flex items-center font-medium rounded-full border
      ${sizes[size]}
      ${meta.bg} ${meta.color} ${meta.border}
    `}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
      {meta.label}
    </span>
  )
}
