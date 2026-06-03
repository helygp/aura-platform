'use client'

/**
 * components/checkout/PaymentMethodSelector.tsx
 * Seletor de forma de pagamento: Pix / Boleto / A combinar.
 * Visual em cards — não radio buttons nativos.
 */

type PaymentMethod = 'pix' | 'boleto' | 'a_combinar'

interface Option {
  value:       PaymentMethod
  label:       string
  description: string
  icon:        () => JSX.Element
}

const OPTIONS: Option[] = [
  {
    value:       'pix',
    label:       'Pix',
    description: 'Chave enviada após confirmação do pedido',
    icon:        PixIcon,
  },
  {
    value:       'boleto',
    label:       'Boleto bancário',
    description: 'Vencimento em 3 dias úteis',
    icon:        BoletoIcon,
  },
  {
    value:       'a_combinar',
    label:       'A combinar',
    description: 'Faturamento ou outra condição',
    icon:        HandshakeIcon,
  },
]

interface Props {
  value:    PaymentMethod
  onChange: (v: PaymentMethod) => void
}

export default function PaymentMethodSelector({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {OPTIONS.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              'flex items-center gap-3 rounded-[var(--radius)] border p-3.5 text-left transition',
              selected
                ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                : 'border-border hover:border-primary/50',
            ].join(' ')}
            aria-pressed={selected}
          >
            {/* Radio visual */}
            <span
              className={[
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition',
                selected ? 'border-primary' : 'border-border',
              ].join(' ')}
            >
              {selected && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
            </span>

            {/* Ícone */}
            <span className={selected ? 'text-primary' : 'text-muted-foreground'}>
              <opt.icon />
            </span>

            {/* Texto */}
            <span className="flex flex-col gap-0.5">
              <span className={`text-sm font-medium ${selected ? 'text-foreground' : 'text-foreground'}`}>
                {opt.label}
              </span>
              <span className="text-xs text-muted-foreground">{opt.description}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Ícones ───────────────────────────────────────────────────────────────────

function PixIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
    </svg>
  )
}
function BoletoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="6" y1="9" x2="6" y2="15" /><line x1="9" y1="9" x2="9" y2="15" />
      <line x1="12" y1="9" x2="12" y2="15" /><line x1="15" y1="9" x2="15" y2="15" />
      <line x1="18" y1="9" x2="18" y2="15" />
    </svg>
  )
}
function HandshakeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="m11 17 2 2a1 1 0 1 0 3-3" />
      <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
      <path d="m21 3 1 11h-2" />
      <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
      <path d="M3 4h8" />
    </svg>
  )
}
