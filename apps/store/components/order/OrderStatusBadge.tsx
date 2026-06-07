/**
 * components/order/OrderStatusBadge.tsx
 * Badge de status com alto contraste — usa cores sólidas com texto branco/escuro.
 */

interface Props {
  status: string
  size?: 'sm' | 'md'
}

interface BadgeConfig {
  label:   string
  bg:      string
  color:   string
  dot:     string
}

const CONFIG: Record<string, BadgeConfig> = {
  pendente:   { label: 'Aguardando',   bg: '#92400e', color: '#fff', dot: '#fbbf24' },
  confirmado: { label: 'Confirmado',   bg: '#1e40af', color: '#fff', dot: '#60a5fa' },
  separando:  { label: 'Em separação', bg: '#5b21b6', color: '#fff', dot: '#a78bfa' },
  enviado:    { label: 'Enviado',      bg: '#0e7490', color: '#fff', dot: '#38bdf8' },
  entregue:   { label: 'Entregue',     bg: '#166534', color: '#fff', dot: '#4ade80' },
  cancelado:  { label: 'Cancelado',    bg: '#991b1b', color: '#fff', dot: '#f87171' },
}

export default function OrderStatusBadge({ status, size = 'md' }: Props) {
  const cfg = CONFIG[status.toLowerCase()] ?? {
    label: status, bg: '#374151', color: '#fff', dot: '#9ca3af'
  }

  const pad    = size === 'sm' ? '2px 9px' : '3px 11px'
  const fsize  = size === 'sm' ? 11         : 12
  const dotSz  = size === 'sm' ? 5          : 6

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: pad, borderRadius: 999,
      background: cfg.bg, color: cfg.color,
      fontSize: fsize, fontWeight: 600, letterSpacing: '.01em',
      lineHeight: 1.5, whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: dotSz, height: dotSz, borderRadius: '50%',
        background: cfg.dot, flexShrink: 0,
        boxShadow: `0 0 0 1.5px ${cfg.dot}40`,
      }} />
      {cfg.label}
    </span>
  )
}
