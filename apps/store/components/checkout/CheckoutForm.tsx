'use client'

/**
 * components/checkout/CheckoutForm.tsx
 * Formulário de checkout B2B.
 *
 * Campos:
 *   - Endereço de entrega (textarea)
 *   - Observações (textarea opcional)
 *   - Forma de pagamento (cards visuais)
 *
 * Fluxo:
 *   1. Lê carrinho do localStorage
 *   2. Valida campos
 *   3. POST /store/orders → recebe { ref }
 *   4. Limpa carrinho
 *   5. Redireciona para /pedido/[ref]
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/useCart'
import { ordersApi } from '@/lib/api'
import PaymentMethodSelector, { type PaymentMethod } from './PaymentMethodSelector'
import { useAuth } from '@/lib/useAuth'
import OrderSummaryPanel from './OrderSummaryPanel'


interface Props {
  tenantSlug:         string
  minimumOrderAmount: number
}

interface FormErrors {
  deliveryAddress?: string
  paymentMethod?:   string
  general?:         string
}

export default function CheckoutForm({ tenantSlug, minimumOrderAmount }: Props) {
  const router = useRouter()
  const { items, total, clear, isEmpty, isLoaded } = useCart()
  const { buyer } = useAuth()
  // No estado atual só Crédito está ativo — sem crédito = sem checkout possível
  const hasUsablePayment = (buyer?.creditAvailable ?? 0) >= total

  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [notes,           setNotes]           = useState('')
  const [paymentMethod,   setPaymentMethod]   = useState<PaymentMethod>('credito')
  const [errors,          setErrors]          = useState<FormErrors>({})
  const [submitting,      setSubmitting]       = useState(false)

  // Redireciona se carrinho esvaziar fora do fluxo (ex: outra aba)
  useEffect(() => {
    if (isLoaded && isEmpty && !submitting) {
      router.replace('/carrinho')
    }
  }, [isLoaded, isEmpty, submitting, router])

  // ── Validação ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: FormErrors = {}

    if (!deliveryAddress.trim()) {
      errs.deliveryAddress = 'Informe o endereço de entrega.'
    }

    if (minimumOrderAmount > 0 && total < minimumOrderAmount) {
      errs.general = `Valor mínimo do pedido: ${fmtPrice(minimumOrderAmount)}.`
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!validate() || submitting) return
    setSubmitting(true)
    setErrors({})

    try {
      const payload = {
        items: items.map(i => ({ skuToken: i.skuId, quantity: i.quantity })),
        deliveryAddress: deliveryAddress.trim(),
        notes:           notes.trim() || undefined,
        paymentMethod,
      }

      const { ref } = await ordersApi.create(tenantSlug, payload)

      // Limpa o carrinho antes de redirecionar
      clear()

      router.push(`/pedido/${ref}`)

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar pedido. Tente novamente.'
      setErrors({ general: msg })
      setSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoaded && isEmpty && !submitting) return null  // evita flash antes do redirect

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Finalizar pedido</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Revise os dados e conclua seu pedido.
        </p>
      </div>

      {/* Layout: formulário + resumo */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">

        {/* ── Formulário ── */}
        <div className="flex flex-1 flex-col gap-6">

          {/* Endereço de entrega */}
          <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Endereço de entrega</h2>

            <div className="flex flex-col gap-1">
              <label htmlFor="deliveryAddress" className="text-xs font-medium text-muted-foreground">
                Endereço completo <span className="text-red-500">*</span>
              </label>
              <textarea
                id="deliveryAddress"
                rows={3}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Rua, número, complemento, bairro, cidade, estado, CEP"
                className={[
                  'w-full resize-none rounded-[var(--radius)] border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40',
                  errors.deliveryAddress ? 'border-red-500' : 'border-border',
                ].join(' ')}
              />
              {errors.deliveryAddress && (
                <p className="text-xs text-red-500">{errors.deliveryAddress}</p>
              )}
            </div>
          </section>

          {/* Observações */}
          <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">
              Observações
              <span className="ml-1.5 font-normal text-muted-foreground">(opcional)</span>
            </h2>

            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instruções especiais, referência de entrega, etc."
              className="w-full resize-none rounded-[var(--radius)] border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </section>

          {/* Forma de pagamento */}
          <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Forma de pagamento</h2>
            <PaymentMethodSelector
              value={paymentMethod}
              onChange={setPaymentMethod}
              creditAvailable={buyer?.creditAvailable ?? 0}
              orderTotal={total}
            />
          </section>

          {/* Erro geral */}
          {errors.general && (
            <div className="rounded-[var(--radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
              {errors.general}
            </div>
          )}

          {/* CTA mobile (aparece abaixo do form em telas pequenas) */}
          <div className="lg:hidden">
            <SubmitButton submitting={submitting} disabled={!hasUsablePayment} onSubmit={handleSubmit} />
          </div>
        </div>

        {/* ── Sidebar: resumo + CTA desktop ── */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:w-80 lg:shrink-0">
          <OrderSummaryPanel items={items} total={total} />
          <div className="hidden lg:block">
            <SubmitButton submitting={submitting} disabled={!hasUsablePayment} onSubmit={handleSubmit} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Botão de submit extraído para não duplicar ────────────────────────────────

function SubmitButton({ submitting, disabled, onSubmit }: { submitting: boolean; disabled?: boolean; onSubmit: () => void }) {
  return (
    <button
      type="button"
      onClick={onSubmit}
      disabled={submitting || disabled}
      className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90 active:scale-95 disabled:opacity-60"
    >
      {submitting ? (
        <>
          <SpinnerIcon />
          Criando pedido…
        </>
      ) : (
        <>
          <CheckIcon />
          Confirmar pedido
        </>
      )}
    </button>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
