/**
 * pages/receivables/ReceivablesPage.jsx
 * Contas a Receber — extrato financeiro do cliente.
 *
 * T2.1 — filtro por data com recomposição de saldo de abertura
 * T2.2 — forma de pagamento + upload de comprovante
 * fix #82 — saldo devedor reflete período filtrado
 * ticket #118 — busca de cliente, presets de período, validação de pagamento,
 *               saldo corrente após cada movimento, drilldown de pedido em modal
 *               (rev2) — filtro sempre visível, chip "Tudo" no lugar do checkbox
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '../../auth/AuthContext.jsx'

const fmt  = cents => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format((cents ?? 0) / 100)
const fmtDate = iso => {
  if (!iso) return '—'
  try { return new Intl.DateTimeFormat('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(iso)) }
  catch { return '—' }
}
const toISODate = d => d.toISOString().slice(0, 10)

function rangeForPreset(preset) {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate()
  const dow = now.getDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow

  switch (preset) {
    case 'today':   return { from: toISODate(new Date(y, m, d)),                  to: toISODate(new Date(y, m, d)) }
    case 'week':    return { from: toISODate(new Date(y, m, d + mondayOffset)),    to: toISODate(new Date(y, m, d + mondayOffset + 6)) }
    case 'month':   return { from: toISODate(new Date(y, m, 1)),                  to: toISODate(new Date(y, m + 1, 0)) }
    case 'last30':  return { from: toISODate(new Date(y, m, d - 29)),             to: toISODate(new Date(y, m, d)) }
    default:        return null
  }
}

const QUICK_PRESETS = [
  { id: 'all',    label: 'Tudo' },
  { id: 'today',  label: 'Hoje' },
  { id: 'week',   label: 'Esta semana' },
  { id: 'month',  label: 'Este mês' },
  { id: 'last30', label: '30 dias' },
  { id: 'custom', label: 'Personalizado' },
]

const PAYMENT_METHODS = [
  { value: 'pix',           label: 'Pix' },
  { value: 'boleto',        label: 'Boleto' },
  { value: 'dinheiro',      label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cartao',        label: 'Cartão' },
  { value: 'outros',        label: 'Outros' },
]
const PM_LABEL = Object.fromEntries(PAYMENT_METHODS.map(p => [p.value, p.label]))
const PM_LABEL_ALL = { ...PM_LABEL, a_combinar: 'A combinar', credito: 'Crédito' }

function authFetch(url, opts = {}) {
  const tok = window.__aura_mem_token__ || ''
  return fetch(url, {
    ...opts,
    credentials: 'include',
    headers: {
      ...(tok ? { Authorization: 'Bearer ' + tok } : {}),
      ...(opts.headers ?? {}),
    },
  })
}

function authFetchJson(url, opts = {}) {
  return authFetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
  })
}

function txCategory(tx) {
  const desc = (tx.description || '').toLowerCase()
  if (tx.type === 'credit') {
    if (desc.startsWith('estorno') || desc.startsWith('devolução'))
      return { icon: '↩', tone: 'amber', label: 'Estorno' }
    if (desc.startsWith('ajuste'))
      return { icon: '⚖', tone: 'slate', label: 'Ajuste' }
    return { icon: '💸', tone: 'green', label: 'Pagamento' }
  }
  if (desc.startsWith('ajuste'))
    return { icon: '⚖', tone: 'slate', label: 'Ajuste' }
  if (tx.orderRef)
    return { icon: '🛒', tone: 'red', label: 'Pedido' }
  return { icon: '–', tone: 'red', label: 'Débito' }
}

export function ReceivablesPage() {
  const { user } = useAuth()

  const [buyers,        setBuyers]        = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [selected,      setSelected]      = useState(null)
  const [detail,        setDetail]        = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [customerSearch, setCustomerSearch] = useState('')

  // Filtro de período sempre ativo (default: mês corrente). 'all' = sem filtro.
  const initialRange = rangeForPreset('month')
  const [dateFrom,    setDateFrom]    = useState(initialRange.from)
  const [dateTo,      setDateTo]      = useState(initialRange.to)
  const [quickPreset, setQuickPreset] = useState('month')

  // Modal de pedido (drilldown sob demanda)
  const [orderModal, setOrderModal] = useState(null)

  // Modal pagamento
  const [payModal,     setPayModal]     = useState(false)
  const [payAmount,    setPayAmount]    = useState('')
  const [payDesc,      setPayDesc]      = useState('Pagamento recebido')
  const [payMethod,    setPayMethod]    = useState('pix')
  const [receiptFile,  setReceiptFile]  = useState(null)
  const [receiptB64,   setReceiptB64]   = useState(null)
  const [paying,       setPaying]       = useState(false)
  const [payError,     setPayError]     = useState(null)
  const fileInputRef = useRef(null)

  // Modal limite
  const [limitModal,  setLimitModal]  = useState(false)
  const [limitValue,  setLimitValue]  = useState('')
  const [savingLimit, setSavingLimit] = useState(false)
  const [limitError,  setLimitError]  = useState(null)

  // Args atuais do fetch baseado no preset selecionado
  const currentFetchArgs = useCallback(() => {
    if (quickPreset === 'all') return { filtered: false }
    return { from: dateFrom, to: dateTo, filtered: true }
  }, [quickPreset, dateFrom, dateTo])

  const loadBuyers = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await authFetchJson('/api/wallet/receivables')
      const d   = await res.json()
      if (!res.ok) throw new Error(d.error || 'Erro ao carregar')
      setBuyers(d.buyers ?? [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [user])

  useEffect(() => { if (user) loadBuyers() }, [loadBuyers, user])

  const filteredBuyers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase()
    if (!q) return buyers
    return buyers.filter(b =>
      (b.name || '').toLowerCase().includes(q) ||
      (b.email || '').toLowerCase().includes(q) ||
      (b.companyName || '').toLowerCase().includes(q)
    )
  }, [buyers, customerSearch])

  const fetchDetail = useCallback(async (buyer, { from, to, filtered } = {}) => {
    setDetail(null)
    setDetailLoading(true)
    try {
      const qs = new URLSearchParams()
      if (filtered && from) qs.set('dateFrom', from)
      if (filtered && to)   qs.set('dateTo',   to)
      const url = `/api/wallet/buyers/${buyer.id}${qs.toString() ? '?' + qs : ''}`
      const res = await authFetchJson(url)
      const d   = await res.json()
      if (!res.ok) throw new Error(d.error || 'Erro')
      setDetail(d)
    } catch (e) { setError(e.message) }
    finally { setDetailLoading(false) }
  }, [])

  async function openDetail(buyer) {
    setSelected(buyer)
    await fetchDetail(buyer, currentFetchArgs())
  }

  function applyFilter() {
    if (selected) fetchDetail(selected, { from: dateFrom, to: dateTo, filtered: true })
  }

  function applyPreset(presetId) {
    setQuickPreset(presetId)
    if (presetId === 'all') {
      if (selected) fetchDetail(selected, { filtered: false })
      return
    }
    if (presetId === 'custom') return // espera o usuário clicar "Filtrar"
    const range = rangeForPreset(presetId)
    if (!range) return
    setDateFrom(range.from)
    setDateTo(range.to)
    if (selected) fetchDetail(selected, { from: range.from, to: range.to, filtered: true })
  }

  function toggleOrder(/* removido */) {}

  function openOrderModal(orderRef) {
    if (!detail || !orderRef) return
    const order = (detail.orders ?? []).find(o =>
      o.ref === orderRef || o.id === orderRef ||
      (o.ref && (o.ref === `#${orderRef}` || `#${o.ref}` === orderRef))
    )
    setOrderModal(order ? { kind: 'ok', order } : { kind: 'missing', ref: orderRef })
  }

  // Saldo corrente após cada movimento (extrato bancário)
  const txWithBalance = useMemo(() => {
    if (!detail) return []
    const asc = [...(detail.transactions ?? [])].reverse()
    let running = detail.openingBalance ?? 0
    const withBal = asc.map(tx => {
      running += tx.type === 'debit' ? tx.amount : -tx.amount
      return { ...tx, balance: running }
    })
    return withBal.reverse()
  }, [detail])

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5_000_000) { setPayError('Arquivo muito grande (máx 5 MB).'); return }
    setReceiptFile(file)
    const reader = new FileReader()
    reader.onload = ev => setReceiptB64(ev.target.result)
    reader.readAsDataURL(file)
  }

  function resetPayModal() {
    setPayModal(false); setPayAmount(''); setPayDesc('Pagamento recebido')
    setPayMethod('pix'); setReceiptFile(null); setReceiptB64(null); setPayError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const payAmountCents = useMemo(() => {
    const n = parseFloat((payAmount || '').replace(',', '.'))
    if (!isFinite(n) || n <= 0) return 0
    return Math.round(n * 100)
  }, [payAmount])
  const balanceCents = selected?.creditBalance ?? 0
  const payExceeds   = payAmountCents > 0 && payAmountCents > balanceCents
  const payValid     = payAmountCents > 0 && payAmountCents <= balanceCents

  async function handlePayment() {
    if (!payAmountCents) return setPayError('Valor inválido.')
    if (payAmountCents > balanceCents)
      return setPayError(`Valor maior que o saldo devedor (${fmt(balanceCents)}).`)

    setPaying(true); setPayError(null)
    try {
      const res = await authFetchJson(`/api/wallet/buyers/${selected.id}/payment`, {
        method: 'POST',
        body: JSON.stringify({
          amount:        payAmountCents,
          description:   payDesc || 'Pagamento recebido',
          paymentMethod: payMethod,
          receiptData:   receiptB64 ?? null,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      resetPayModal()
      await loadBuyers()
      if (selected) await fetchDetail(selected, currentFetchArgs())
    } catch (e) { setPayError(e.message) }
    finally { setPaying(false) }
  }

  async function handleSaveLimit() {
    const limitDecimal = parseFloat(limitValue.replace(',', '.'))
    if (isNaN(limitDecimal) || limitDecimal < 0) return setLimitError('Limite inválido.')
    setSavingLimit(true); setLimitError(null)
    try {
      const res = await authFetchJson(`/api/wallet/buyers/${selected.id}/limit`, {
        method: 'PATCH',
        body: JSON.stringify({ creditLimit: limitDecimal }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setLimitModal(false); setLimitValue('')
      await loadBuyers()
      if (selected) await fetchDetail(selected, currentFetchArgs())
    } catch (e) { setLimitError(e.message) }
    finally { setSavingLimit(false) }
  }

  function printReport() {
    if (!detail || !selected) return
    const win = window.open('', '_blank', 'width=900,height=700')
    win.document.write(buildReportHtml(selected, detail))
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  return (
    <div className="flex h-full gap-0 overflow-hidden">

      {/* ── Lista de compradores ── */}
      <div className={`flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] ${selected ? 'hidden md:flex md:w-80 lg:w-96' : 'w-full md:w-80 lg:w-96'}`}>
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h1 className="text-base font-semibold text-[var(--color-text-primary)]">Contas a Receber</h1>
          <button onClick={loadBuyers} className="rounded p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]" title="Atualizar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
          </button>
        </div>

        {/* Busca de cliente */}
        <div className="border-b border-[var(--color-border)] px-3 py-2">
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] pointer-events-none">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input type="text" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
              placeholder="Buscar cliente…"
              className="w-full h-8 pl-8 pr-7 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
            {customerSearch && (
              <button onClick={() => setCustomerSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                title="Limpar">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            )}
          </div>
        </div>

        {error && <p className="px-4 py-2 text-xs text-red-500">{error}</p>}

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-[var(--color-text-secondary)]">Carregando…</div>
        ) : filteredBuyers.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {customerSearch ? 'Nenhum cliente encontrado.' : 'Nenhum cliente com limite configurado.'}
            </p>
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto divide-y divide-[var(--color-border)]">
            {filteredBuyers.map(b => (
              <li key={b.id} onClick={() => openDetail(b)}
                className={`cursor-pointer px-4 py-3 hover:bg-[var(--color-surface-hover)] transition-colors ${selected?.id === b.id ? 'bg-[var(--color-surface-hover)]' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">{b.name}</p>
                    <p className="truncate text-xs text-[var(--color-text-secondary)]">{b.email}</p>
                  </div>
                  {b.creditBalance > 0 && (
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">{fmt(b.creditBalance)}</span>
                  )}
                </div>
                {b.creditLimit > 0 && (
                  <div className="mt-2">
                    <div className="mb-1 flex justify-between text-[10px] text-[var(--color-text-secondary)]">
                      <span>Usado: {fmt(b.creditBalance)}</span>
                      <span>Limite: {fmt(b.creditLimit)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
                      <div className="h-full rounded-full transition-all"
                        style={{ width:`${Math.min(100, b.creditLimit > 0 ? (b.creditBalance/b.creditLimit)*100 : 0)}%`,
                          background: b.creditBalance/b.creditLimit > 0.8 ? '#ef4444' : 'var(--color-primary)' }} />
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Extrato do comprador ── */}
      {selected ? (
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            <button onClick={() => setSelected(null)} className="rounded p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] md:hidden">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{selected.name}</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">{selected.email}</p>
            </div>
            <button onClick={printReport} disabled={!detail}
              className="shrink-0 rounded border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-40">
              Imprimir
            </button>
            <button onClick={() => { setLimitValue(((selected.creditLimit||0)/100).toFixed(2).replace('.',',')); setLimitModal(true) }}
              className="shrink-0 rounded border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]">
              Limite
            </button>
            <button onClick={() => { setPayError(null); setPayModal(true) }} disabled={!selected.creditBalance}
              className="shrink-0 rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-40">
              + Pagamento
            </button>
          </div>

          {/* ── Filtro de período: chips sempre visíveis ── */}
          <div className="flex flex-col gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-[var(--color-text-secondary)] mr-1.5 font-medium">Período:</span>
              {QUICK_PRESETS.map(p => (
                <button key={p.id} onClick={() => applyPreset(p.id)}
                  className={`h-7 px-3 text-xs font-medium rounded-full border transition-colors ${
                    quickPreset === p.id
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
            {quickPreset === 'custom' && (
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="h-7 px-2 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
                <span className="text-xs text-[var(--color-text-secondary)]">até</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="h-7 px-2 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
                <button onClick={applyFilter}
                  className="h-7 px-3 text-xs font-medium rounded bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90">
                  Filtrar
                </button>
              </div>
            )}
            {quickPreset !== 'custom' && quickPreset !== 'all' && (
              <p className="text-[10px] text-[var(--color-text-secondary)]">{dateFrom} → {dateTo}</p>
            )}
          </div>

          {/* Saldos */}
          {detail && (() => {
            const periodBalance = detail.filtered
              ? detail.openingBalance + detail.transactions.reduce(
                  (sum, t) => sum + (t.type === 'debit' ? t.amount : -t.amount), 0
                )
              : detail.buyer.creditBalance
            return (
              <div className="grid grid-cols-3 gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
                {[
                  { label:'Limite',     value: detail.buyer.creditLimit,    cls:'' },
                  { label: detail.filtered ? 'Saldo no período' : 'Saldo devedor', value: periodBalance, cls: periodBalance > 0 ? 'text-red-600' : '' },
                  { label:'Disponível', value: detail.buyer.creditAvailable, cls: detail.buyer.creditAvailable > 0 ? 'text-green-600' : 'text-[var(--color-text-secondary)]' },
                ].map(({label, value, cls}) => (
                  <div key={label} className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">{label}</p>
                    <p className={`text-sm font-bold text-[var(--color-text-primary)] ${cls}`}>{fmt(value)}</p>
                  </div>
                ))}
              </div>
            )
          })()}

          {detailLoading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-[var(--color-text-secondary)]">Carregando…</div>
          ) : detail ? (
            <div className="flex-1 overflow-y-auto">

              {/* Saldo de abertura do período */}
              {detail.filtered && detail.openingBalance > 0 && (
                <div className="mx-4 mt-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-2.5">
                  <div>
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Saldo anterior ao período</p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-500">Devedor antes de {dateFrom}</p>
                  </div>
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{fmt(detail.openingBalance)}</span>
                </div>
              )}

              {/* Extrato puro: APENAS movimentações financeiras */}
              <div className="px-4 pb-6 pt-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Movimentações {detail.filtered ? `(${dateFrom} – ${dateTo})` : ''}
                </h3>
                {txWithBalance.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">Sem movimentações{detail.filtered ? ' no período' : ''}.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {txWithBalance.map(tx => (
                      <TxRow key={tx.id} tx={tx}
                        onOrderClick={tx.orderRef ? () => openOrderModal(tx.orderRef) : null} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="hidden flex-1 items-center justify-center md:flex">
          <p className="text-sm text-[var(--color-text-secondary)]">Selecione um cliente para ver o extrato</p>
        </div>
      )}

      {/* ── Modal Pedido (drilldown) ── */}
      {orderModal && (
        <Modal title={orderModal.kind === 'ok' ? `Pedido ${orderModal.order.ref || '—'}` : 'Pedido não disponível'}
               size="lg" onClose={() => setOrderModal(null)}>
          {orderModal.kind === 'ok'
            ? <OrderDetails order={orderModal.order} />
            : <div className="text-sm text-[var(--color-text-secondary)]">
                <p>Esse pedido não está incluído no período filtrado.</p>
                <p className="mt-2">Selecione "Tudo" ou amplie o intervalo para visualizar os detalhes.</p>
              </div>
          }
          <div className="mt-5 flex justify-end">
            <button onClick={() => setOrderModal(null)}
              className="rounded-[var(--radius)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface-hover)]">
              Fechar
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal Pagamento ── */}
      {payModal && (
        <Modal title="Registrar Pagamento" onClose={() => !paying && resetPayModal()}>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            Cliente: <strong className="text-[var(--color-text-primary)]">{selected?.name}</strong><br/>
            Saldo devedor: <strong className="text-red-600">{fmt(selected?.creditBalance)}</strong>
          </p>
          {payError && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-xs text-red-600">{payError}</p>}
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Valor recebido (R$)</label>
              <input type="text" inputMode="decimal" value={payAmount} onChange={e=>setPayAmount(e.target.value)} placeholder="0,00"
                className={`w-full rounded-[var(--radius)] border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  payExceeds
                    ? 'border-red-400 bg-red-50/40 focus:ring-red-200'
                    : 'border-[var(--color-border)] bg-[var(--color-background)] focus:ring-[var(--color-primary)]/40'
                }`} />
              {payExceeds && (
                <p className="mt-1 text-[11px] text-red-600">
                  Valor maior que o saldo devedor ({fmt(balanceCents)}). Use no máximo esse valor.
                </p>
              )}
              {payAmountCents > 0 && payValid && payAmountCents === balanceCents && (
                <p className="mt-1 text-[11px] text-green-600">✓ Quita o saldo integralmente.</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Forma de pagamento</label>
              <select value={payMethod} onChange={e=>setPayMethod(e.target.value)}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40">
                {PAYMENT_METHODS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Descrição</label>
              <input type="text" value={payDesc} onChange={e=>setPayDesc(e.target.value)}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Comprovante (opcional — PDF, imagem, máx 5 MB)</label>
              <div className="flex items-center gap-2">
                <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={handleFileChange}
                  className="block w-full text-xs text-[var(--color-text-secondary)] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-[var(--color-surface-hover)] file:text-[var(--color-text-primary)] hover:file:opacity-80 cursor-pointer" />
                {receiptFile && (
                  <button onClick={() => { setReceiptFile(null); setReceiptB64(null); if(fileInputRef.current) fileInputRef.current.value='' }}
                    className="shrink-0 text-[10px] text-red-500 hover:underline">Remover</button>
                )}
              </div>
              {receiptFile && (
                <p className="mt-1 text-[10px] text-green-600">✓ {receiptFile.name} ({(receiptFile.size/1024).toFixed(0)} KB)</p>
              )}
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={resetPayModal} disabled={paying} className="flex-1 rounded-[var(--radius)] border border-[var(--color-border)] py-2 text-sm font-medium hover:bg-[var(--color-surface-hover)] disabled:opacity-50">Cancelar</button>
            <button onClick={handlePayment} disabled={paying || !payValid}
              className="flex flex-1 items-center justify-center rounded-[var(--radius)] bg-[var(--color-primary)] py-2 text-sm font-semibold text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed">
              {paying ? 'Registrando…' : 'Confirmar'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal Limite ── */}
      {limitModal && (
        <Modal title="Limite de Crédito" onClose={() => !savingLimit && setLimitModal(false)}>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            Cliente: <strong className="text-[var(--color-text-primary)]">{selected?.name}</strong>
          </p>
          {limitError && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-xs text-red-600">{limitError}</p>}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Limite (R$) — 0 = sem limite ativo</label>
            <input type="text" inputMode="decimal" value={limitValue} onChange={e=>setLimitValue(e.target.value)} placeholder="0,00"
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40" />
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={()=>setLimitModal(false)} disabled={savingLimit} className="flex-1 rounded-[var(--radius)] border border-[var(--color-border)] py-2 text-sm font-medium hover:bg-[var(--color-surface-hover)] disabled:opacity-50">Cancelar</button>
            <button onClick={handleSaveLimit} disabled={savingLimit} className="flex flex-1 items-center justify-center rounded-[var(--radius)] bg-[var(--color-primary)] py-2 text-sm font-semibold text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-60">
              {savingLimit ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Linha de movimentação no extrato ──
function TxRow({ tx, onOrderClick }) {
  const cat        = txCategory(tx)
  const isCredit   = tx.type === 'credit'
  const clickable  = !!onOrderClick
  const toneClasses = {
    green:  'bg-green-100 text-green-700',
    red:    'bg-red-100 text-red-700',
    amber:  'bg-amber-100 text-amber-700',
    slate:  'bg-slate-100 text-slate-700',
  }[cat.tone] || 'bg-slate-100 text-slate-700'

  return (
    <li
      onClick={clickable ? onOrderClick : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOrderClick() } }) : undefined}
      title={clickable ? 'Clique para ver o pedido' : undefined}
      className={`flex items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-2.5 ${
        clickable
          ? 'cursor-pointer hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] transition-colors'
          : ''
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${toneClasses}`}>
          {cat.icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{tx.description}</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <p className="text-[10px] text-[var(--color-text-secondary)]">{fmtDate(tx.createdAt)}</p>
            {tx.paymentMethod && (
              <span className="text-[10px] rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 font-medium">
                {PM_LABEL[tx.paymentMethod] ?? tx.paymentMethod}
              </span>
            )}
            {tx.orderRef && (
              <span className="text-[10px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 font-mono">
                #{String(tx.orderRef).slice(-6).toUpperCase()}
              </span>
            )}
            {tx.hasReceipt && (
              <a href={`/api/wallet/transactions/${tx.id}/receipt`} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-[10px] rounded-full bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 font-medium hover:opacity-80">
                📎 Comprovante
              </a>
            )}
            {clickable && (
              <span className="text-[10px] text-[var(--color-primary)] font-medium">
                ver pedido →
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className={`text-sm font-semibold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
          {isCredit ? '+' : '−'}{fmt(tx.amount)}
        </span>
        <span className="text-[10px] text-[var(--color-text-secondary)]">
          saldo: <span className={`tabular-nums font-medium ${tx.balance > 0 ? 'text-red-500/90' : 'text-[var(--color-text-secondary)]'}`}>{fmt(tx.balance)}</span>
        </span>
      </div>
    </li>
  )
}

// ── Detalhe do pedido dentro do modal ──
function OrderDetails({ order }) {
  const items = order.items ?? []
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] p-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">Status</p>
          <div className="mt-0.5"><StatusBadge status={order.status} /></div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">Pagamento</p>
          <p className="mt-0.5 text-xs font-medium text-[var(--color-text-primary)]">
            {PM_LABEL_ALL[order.paymentMethod] ?? (order.paymentMethod || '—').replace('_',' ')}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">Data</p>
          <p className="mt-0.5 text-xs font-medium text-[var(--color-text-primary)]">{fmtDate(order.createdAt)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">Total</p>
          <p className="mt-0.5 text-sm font-bold text-[var(--color-text-primary)]">{fmt(order.total)}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Sem itens neste pedido.</p>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)]">
          <table className="w-full text-xs">
            <thead className="bg-[var(--color-surface-hover)]">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-[var(--color-text-secondary)]">SKU</th>
                <th className="px-3 py-2 text-left font-semibold text-[var(--color-text-secondary)]">Produto</th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--color-text-secondary)]">Qtd</th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--color-text-secondary)]">Preço</th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--color-text-secondary)]">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {items.map(it => {
                const cancelled = it.status === 'cancelado'
                const returned  = (it.qtyReturned || 0) > 0
                const activeQty = it.qty - (it.qtyReturned || 0)
                return (
                  <tr key={it.id} className={cancelled ? 'opacity-50' : ''}>
                    <td className={`px-3 py-2 font-mono text-[10px] text-[var(--color-text-secondary)] ${cancelled ? 'line-through' : ''}`}>{it.skuCode || '—'}</td>
                    <td className={`px-3 py-2 ${cancelled ? 'line-through' : ''}`}>
                      <span className="text-[var(--color-text-primary)]">{it.productName}</span>
                      {it.attributes && Object.keys(it.attributes).length > 0 && (
                        <span className="ml-1 text-[10px] text-[var(--color-text-secondary)]">
                          ({Object.values(it.attributes).join(' / ')})
                        </span>
                      )}
                      {cancelled && <span className="ml-2 text-[10px] rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 font-medium no-underline">cancelado</span>}
                      {returned && !cancelled && <span className="ml-2 text-[10px] rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 font-medium">devolvido {it.qtyReturned}x</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">
                      {cancelled || returned ? `${activeQty}/${it.qty}` : it.qty}x
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">{fmt(it.priceUnit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-[var(--color-text-primary)]">{fmt(activeQty * it.priceUnit)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Modal({ title, onClose, children, size = 'sm' }) {
  const widthCls = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
  }[size] || 'max-w-sm'
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className={`fixed left-1/2 top-1/2 z-50 w-[90vw] ${widthCls} -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-6 shadow-xl overflow-y-auto max-h-[90vh]`}>
        <h2 className="mb-4 text-base font-semibold text-[var(--color-text-primary)]">{title}</h2>
        {children}
      </div>
    </>
  )
}

const STATUS_MAP = {
  pendente:    { label:'Pendente',    cls:'bg-amber-100 text-amber-800' },
  confirmado:  { label:'Confirmado',  cls:'bg-blue-100 text-blue-800' },
  separando:   { label:'Separando',   cls:'bg-violet-100 text-violet-800' },
  enviado:     { label:'Enviado',     cls:'bg-sky-100 text-sky-800' },
  entregue:    { label:'Entregue',    cls:'bg-green-100 text-green-800' },
  cancelado:   { label:'Cancelado',   cls:'bg-red-100 text-red-800' },
}
function StatusBadge({ status }) {
  const {label, cls} = STATUS_MAP[status] ?? { label: status, cls: 'bg-gray-100 text-gray-700' }
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>
}

/* ─── Relatório HTML para impressão (sem itens dos pedidos) ─── */
function buildReportHtml(customer, detail) {
  const now   = new Intl.DateTimeFormat('pt-BR', { dateStyle:'full', timeStyle:'short' }).format(new Date())
  const fmtC  = cents => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format((cents ?? 0) / 100)
  const fDate = iso => { try { return new Intl.DateTimeFormat('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(iso)) } catch { return '—' } }
  const PM_PT = { pix:'Pix', boleto:'Boleto', dinheiro:'Dinheiro', transferencia:'Transferência', cartao:'Cartão', outros:'Outros', a_combinar:'A combinar', credito:'Crédito' }
  const STATUS_PT = { pendente:'Pendente', confirmado:'Confirmado', separando:'Separando', enviado:'Enviado', entregue:'Entregue', cancelado:'Cancelado' }

  const txRows = (detail.transactions ?? []).map(t => `
    <tr>
      <td>${fDate(t.createdAt)}</td>
      <td>${t.description}</td>
      <td>${PM_PT[t.paymentMethod] ?? (t.paymentMethod || '—')}</td>
      <td class="${t.type==='debit'?'debit':'credit'}">${t.type==='debit'?'Débito':'Crédito'}</td>
      <td class="num ${t.type==='debit'?'debit':'credit'}">${t.type==='debit'?'−':'+'}${fmtC(t.amount)}</td>
    </tr>`).join('') || '<tr><td colspan="5" class="empty">Sem movimentações</td></tr>'

  const ordRows = (detail.orders ?? []).map(o => `
    <tr>
      <td class="mono">${o.ref || '—'}</td>
      <td>${fDate(o.createdAt)}</td>
      <td>${STATUS_PT[o.status] ?? o.status}</td>
      <td>${PM_PT[o.paymentMethod] ?? (o.paymentMethod || '—')}</td>
      <td class="num">${fmtC(o.total)}</td>
    </tr>`).join('') || '<tr><td colspan="5" class="empty">Sem pedidos</td></tr>'

  const periodo = detail.filtered ? `Período: ${detail.dateFrom ?? ''} a ${detail.dateTo ?? ''}` : 'Histórico completo'

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/><title>Contas a Receber — ${customer.name}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1a1a1a;padding:32px}
  h1{font-size:20px;font-weight:700}.header{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:20px}
  h2{font-size:13px;font-weight:600;color:#444;text-transform:uppercase;letter-spacing:.05em;margin:24px 0 8px}
  .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:12px 0}
  .card{border:1px solid #e0e0e0;border-radius:6px;padding:12px;text-align:center}
  .card .label{font-size:10px;color:#888;text-transform:uppercase;margin-bottom:4px}
  .card .value{font-size:18px;font-weight:700}
  .card.used .value{color:#dc2626}.card.avail .value{color:#16a34a}
  .opening{background:#fffbeb;border:1px solid #fbbf24;border-radius:6px;padding:10px 14px;margin:8px 0;display:flex;justify-content:space-between}
  table{width:100%;border-collapse:collapse;margin-top:4px}
  th{background:#f0f0f0;text-align:left;padding:7px 10px;font-size:11px;font-weight:600;color:#444;text-transform:uppercase;border-bottom:1px solid #ddd}
  td{padding:7px 10px;border-bottom:1px solid #f0f0f0}
  tr:nth-child(even) td{background:#fafafa}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  .mono{font-family:monospace;font-size:11px}
  .debit{color:#dc2626}.credit{color:#16a34a}
  .empty{text-align:center;color:#aaa;padding:16px;font-style:italic}
  .footer{margin-top:32px;border-top:1px solid #e0e0e0;padding-top:12px;font-size:10px;color:#aaa;display:flex;justify-content:space-between}
  @media print{body{padding:16px}@page{margin:1.5cm;size:A4 portrait}}
</style></head><body>
<div class="header">
  <div><h1>Contas a Receber</h1><p style="font-size:11px;color:#666;margin-top:4px">${periodo}</p></div>
  <div style="text-align:right;font-size:11px;color:#666;line-height:1.6"><strong>${customer.name}</strong><br/>${customer.email}<br/>Gerado: ${now}</div>
</div>
<h2>Resumo de crédito</h2>
<div class="cards">
  <div class="card"><div class="label">Limite</div><div class="value">${fmtC(detail.buyer.creditLimit)}</div></div>
  <div class="card used"><div class="label">Saldo devedor</div><div class="value">${fmtC(detail.buyer.creditBalance)}</div></div>
  <div class="card avail"><div class="label">Disponível</div><div class="value">${fmtC(detail.buyer.creditAvailable)}</div></div>
</div>
${detail.filtered && detail.openingBalance > 0 ? `<div class="opening"><span>Saldo anterior ao período (${detail.dateFrom})</span><strong>${fmtC(detail.openingBalance)}</strong></div>` : ''}
<h2>Movimentações</h2>
<table><thead><tr><th>Data</th><th>Descrição</th><th>Forma</th><th>Tipo</th><th class="num">Valor</th></tr></thead>
<tbody>${txRows}</tbody></table>
<h2>Pedidos</h2>
<table><thead><tr><th>Referência</th><th>Data</th><th>Status</th><th>Pagamento</th><th class="num">Total</th></tr></thead>
<tbody>${ordRows}</tbody></table>
<div style="display:flex;justify-content:flex-end;padding:8px 10px 0">Total devedor: <strong style="margin-left:8px;color:#dc2626">${fmtC(detail.buyer.creditBalance)}</strong></div>
<div class="footer"><span>Aura Platform — Contas a Receber</span><span>${now}</span></div>
</body></html>`
}
