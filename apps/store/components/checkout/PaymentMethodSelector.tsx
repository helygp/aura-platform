'use client'

/**
 * components/checkout/PaymentMethodSelector.tsx
 * Seletor de forma de pagamento.
 *
 * Estado atual da plataforma (Jun/2026):
 *   - Crédito: ATIVO (clientes com credit_limit > 0)
 *   - Pix / Boleto: implementados mas DESABILITADOS no UI (em breve)
 *     Quando ativos, basta remover comingSoon: true das BASE_OPTIONS.
 */

import { formatPrice } from '@/lib/cart'

export type PaymentMethod = 'pix' | 'boleto' | 'credito'

interface Option {
  value:       PaymentMethod
  label:       string
  description: string
  icon:        () => JSX.Element
  comingSoon?: boolean
}

const BASE_OPTIONS: Option[] = [
  {
    value:       'pix',
    label:       'Pix',
    description: 'Chave enviada após confirmação do pedido',
    icon:        PixIcon,
    comingSoon:  true,
  },
  {
    value:       'boleto',
    label:       'Boleto bancário',
    description: 'Vencimento em 3 dias úteis',
    icon:        BoletoIcon,
    comingSoon:  true,
  },
]

interface Props {
  value:            PaymentMethod
  onChange:         (v: PaymentMethod) => void
  creditAvailable?: number   // centavos
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
        const disabled = opt.comingSoon
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => disabled ? null : onChange(opt.value)}
            disabled={disabled}
            className={[
              'flex items-center gap-3 rounded-[var(--radius)] border p-3.5 text-left transition',
              disabled
                ? 'cursor-not-allowed border-border bg-muted/30 opacity-55'
                : selected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border hover:border-primary/50',
            ].join(' ')}
            aria-pressed={selected}
            aria-disabled={disabled}
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

            <span className="flex flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                {opt.label}
                {disabled && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                    em breve
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">{opt.description}</span>
            </span>
          </button>
        )
      })}

      {!showCredit && (
        <p className="mt-2 rounded-[var(--radius)] border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Você ainda não tem crédito liberado. Pix e Boleto estarão disponíveis em breve — entre em contato pelo WhatsApp para confirmar pagamento manualmente.
        </p>
      )}
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
