import React from 'react'

const MAP = {
  TRIAL:     { label: 'Trial',     cls: 'bg-blue-100   text-blue-700   dark:bg-blue-900  dark:text-blue-300'  },
  ACTIVE:    { label: 'Ativo',     cls: 'bg-green-100  text-green-700  dark:bg-green-900 dark:text-green-300' },
  SUSPENDED: { label: 'Suspenso',  cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  CANCELLED: { label: 'Cancelado', cls: 'bg-red-100    text-red-700    dark:bg-red-900   dark:text-red-300'   },
  PAID:      { label: 'Pago',      cls: 'bg-green-100  text-green-700  dark:bg-green-900 dark:text-green-300' },
  PENDING:   { label: 'Pendente',  cls: 'bg-gray-100   text-gray-600   dark:bg-gray-800  dark:text-gray-300'  },
  OVERDUE:   { label: 'Vencido',   cls: 'bg-red-100    text-red-700    dark:bg-red-900   dark:text-red-300'   },
}

export function StatusBadge({ status }) {
  const { label, cls } = MAP[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}
