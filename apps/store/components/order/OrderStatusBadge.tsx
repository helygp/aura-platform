/**
 * components/order/OrderStatusBadge.tsx
 * Badge colorido para cada status do pedido.
 * RSC-safe — sem 'use client'.
 */

type OrderStatusValue =
  | 'aguardando_confirmacao'
  | 'confirmado'
  | 'em_separacao'
  | 'enviado'
  | 'entregue'
  | 'cancelado'

interface Props {
  status: OrderStatusValue | string
  size?: 'sm' | 'md'
}

const CONFIG: Record<string, { label: string; className: string }> = {
  aguardando_confirmacao: {
    label: 'Aguardando confirmação',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  confirmado: {
    label: 'Confirmado',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  em_separacao: {
    label: 'Em separação',
    className: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  },
  enviado: {
    label: 'Enviado',
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  },
  entregue: {
    label: 'Entregue',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  },
  cancelado: {
    label: 'Cancelado',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  },
}

export default function OrderStatusBadge({ status, size = 'md' }: Props) {
  const cfg = CONFIG[status] ?? { label: status, className: 'bg-muted text-muted-foreground' }
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${sizeClass} ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}
