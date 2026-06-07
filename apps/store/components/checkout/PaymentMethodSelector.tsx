'use client'

/**
 * components/checkout/PaymentMethodSelector.tsx
 * Seletor de forma de pagamento: Pix / Boleto / Crédito.
 * A opção Crédito só aparece se o cliente tiver crédito disponível (credit_limit > 0).
 * "A combinar" foi removido — pagamento deve ser confirmado na plataforma.
 */

import { formatPrice } from '@/lib/cart'

export type PaymentMethod = 'pix' | 'boleto' | 'credito'

interface Option {
  value:       PaymentMethod
  label:       string
  description: string
  icon:        () => JSX.Element
}

const BASE_OPTIONS: Option[] = [
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
]

interface Props {
  value:            PaymentMethod
  onChange:         (v: PaymentMethod) => void
  creditAvailable?: number   // centavos — se > 0 e >= total, mostra opção crédito
  orderTotal?:      number   // centavos
}

export default function PaymentMethodSelector({ value, onChange, creditAvailable = 0, orderTotal = 0 }: Props) {
  const showCredit = creditAvailable > 0 && creditAvailable >= orderTotal

  const options: Option[] = showCredit
    ? [...BASE_OPTIONS, {
        value:       'credito' as PaymentMethod,
        label:       'Crédito',
        description: `Disponível: ${formatPrice(creditAvailable)}`,
        icon:        CreditIcon,
      }]
    : BASE_OPTIONS

  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => {
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
            <span className={[
              'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition',
              selected ? 'border-primary' : 'border-border',
            ].join(' ')}>
              {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
            </span>

            <span className={selected ? 'text-primary' : 'text-muted-foreground'}>
              <opt.icon />
            </span>

            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{opt.label}</span>
              <span className="text-xs text-muted-foreground">{opt.description}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function PixIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
      <path d="m8 12 2.5 2.5L16 9"/>
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
function CreditIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}
