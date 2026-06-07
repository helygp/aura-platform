/**
 * pages/orders/components/SeparationSheet.jsx
 *
 * Modal de Ficha de Separação — imprimível.
 * Agrupa itens por SKU com sublinhas por pedido.
 * Cada subrow tem checkbox para conferência física.
 */

import React, { useState, useEffect, useRef } from 'react'
import { Printer, X, RefreshCw, AlertTriangle, Package } from 'lucide-react'

function authH() {
  const t = window.__aura_mem_token__ || ''
  return t ? { Authorization: 'Bearer ' + t } : {}
}

const STATUS_LABEL = {
  pendente: 'Pendente', confirmado: 'Confirmado', separando: 'Separando',
  enviado: 'Enviado', entregue: 'Entregue', cancelado: 'Cancelado',
}

/* ── Formata data BR ── */
function fmtDate(d) {
  if (!d) return ''
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

/* ── Linha da tabela ── */
function SheetRow({ group, isFirst }) {
  return group.orders.map((order, oi) => (
    <tr key={`${group.skuCode}-${oi}`} className={[
      'border-b border-gray-200',
      oi === 0 ? 'font-medium' : '',
    ].join(' ')}>
      {/* Colunas fixas do SKU — apenas na primeira sublinha (rowspan via CSS) */}
      {oi === 0 ? (
        <>
          <td rowSpan={group.orders.length} className="px-2 py-1.5 text-xs font-mono font-semibold text-gray-800 border-r border-gray-200 align-top whitespace-nowrap">
            {group.skuCode}
          </td>
          <td rowSpan={group.orders.length} className="px-2 py-1.5 text-xs text-gray-800 border-r border-gray-200 align-top">
            {group.productName}
          </td>
          <td rowSpan={group.orders.length} className="px-2 py-1.5 text-xs text-gray-700 border-r border-gray-200 align-top whitespace-nowrap">
            {group.cor}
          </td>
          <td rowSpan={group.orders.length} className="px-2 py-1.5 text-xs text-center text-gray-700 border-r border-gray-200 align-top whitespace-nowrap">
            {group.tamanho}
          </td>
          <td rowSpan={group.orders.length} className="px-2 py-1.5 text-xs text-center font-semibold text-gray-800 border-r border-gray-200 align-top">
            {group.stockQty}
          </td>
        </>
      ) : null}
      {/* Colunas por pedido */}
      <td className="px-2 py-1.5 text-xs text-center font-bold text-gray-900 border-r border-gray-200">
        {order.qty}
      </td>
      <td className="px-2 py-1.5 text-xs text-center font-mono text-blue-700 border-r border-gray-200 whitespace-nowrap">
        #{order.orderNumber}
      </td>
      <td className="px-2 py-1.5 text-xs text-gray-600 border-r border-gray-200 whitespace-nowrap hidden sm:table-cell print:table-cell">
        {order.customerName}
      </td>
      <td className="px-2 py-1.5 text-center border-r border-gray-200">
        {/* Checkbox imprimível */}
        <span className="inline-block w-4 h-4 border-2 border-gray-500 rounded-sm print:w-5 print:h-5" />
      </td>
    </tr>
  ))
}

export function SeparationSheet({ open, onClose, filters = {}, customers = [] }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const printRef = useRef()

  useEffect(() => {
    if (!open) return
    setError(''); setData(null); setLoading(true)
    const params = new URLSearchParams()
    if (filters.customerId) params.set('customer_id', filters.customerId)
    if (filters.dateFrom)   params.set('start', filters.dateFrom)
    if (filters.dateTo)     params.set('end',   filters.dateTo)
    if (filters.status)     params.set('status', filters.status)

    fetch(`/api/orders/separation-sheet?${params}`, {
      credentials: 'include', headers: authH(),
    })
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [open, JSON.stringify(filters)])

  const handlePrint = () => {
    const content = printRef.current?.innerHTML
    if (!content) return
    const w = window.open('', '_blank', 'width=1000,height=800')
    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Ficha de Separação</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 16px; }
          h1 { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
          .meta { font-size: 10px; color: #555; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f0f0f0; font-size: 10px; font-weight: bold; text-align: center; padding: 5px 4px; border: 1px solid #ccc; }
          th.left { text-align: left; }
          td { padding: 4px; border: 1px solid #ddd; font-size: 10px; vertical-align: top; }
          td.mono { font-family: monospace; font-weight: bold; }
          td.center { text-align: center; }
          td.num { text-align: center; font-weight: bold; color: #000; }
          td.ordnum { text-align: center; font-family: monospace; color: #1a56db; }
          .chk { display: inline-block; width: 14px; height: 14px; border: 2px solid #555; margin: auto; }
          .group-sep td { border-top: 2px solid #999 !important; }
          @media print {
            body { padding: 8px; }
            @page { margin: 1cm; size: A4 landscape; }
          }
        </style>
      </head>
      <body>
        ${content}
        <script>window.print(); window.close();</script>
      </body>
      </html>
    `)
    w.document.close()
  }

  if (!open) return null

  const customerName = filters.customerId
    ? (customers.find(c => c.id === filters.customerId)?.name ?? 'Cliente selecionado')
    : 'Todos os clientes'

  const periodo = [filters.dateFrom, filters.dateTo].filter(Boolean).join(' até ') || 'Todos os períodos'
  const statusLabel = filters.status ? STATUS_LABEL[filters.status] ?? filters.status : 'Todos os status'

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col">
      {/* Barra de controle — hidden on print */}
      <div className="print:hidden flex items-center gap-3 px-4 py-3 bg-[var(--color-bg)] border-b border-[var(--color-border)] shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-[var(--color-text)]">Ficha de Separação</h2>
          <p className="text-xs text-[var(--color-text-muted)] truncate">
            {customerName} · {periodo} · {statusLabel}
          </p>
        </div>
        <button
          onClick={handlePrint}
          disabled={loading || !!error || !data?.items?.length}
          className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold bg-[var(--color-primary)] text-white disabled:opacity-40 hover:opacity-90 shrink-0"
        >
          <Printer size={14} /> Imprimir
        </button>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] shrink-0">
          <X size={16} />
        </button>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto bg-white p-4 sm:p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <RefreshCw size={28} className="animate-spin text-[var(--color-primary)]" />
            <p className="text-sm text-gray-500">Gerando ficha…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <AlertTriangle size={28} className="text-red-500" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : !data?.items?.length ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Package size={28} className="text-gray-400" />
            <p className="text-sm text-gray-500">Nenhum item encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          /* Conteúdo imprimível */
          <div ref={printRef}>
            {/* Cabeçalho */}
            <div className="mb-4">
              <h1 className="text-xl font-bold text-gray-900">Ficha de Separação</h1>
              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                <p>Cliente: <strong className="text-gray-800">{customerName}</strong></p>
                <p>Período: <strong className="text-gray-800">{periodo}</strong> · Status: <strong className="text-gray-800">{statusLabel}</strong></p>
                <p>
                  {data.meta.orderNumbers.length} pedido{data.meta.orderNumbers.length !== 1 ? 's' : ''}
                  {data.meta.orderNumbers.length > 0 && ` (${data.meta.orderNumbers.map(n => '#'+n).join(', ')})`}
                  {' · '}{data.meta.totalSkus} SKU{data.meta.totalSkus !== 1 ? 's' : ''}
                  {' · '}{data.meta.totalQty} unidade{data.meta.totalQty !== 1 ? 's' : ''} no total
                </p>
                <p className="text-[10px] text-gray-400">Gerado em {new Date().toLocaleString('pt-BR')}</p>
              </div>
            </div>

            {/* Tabela */}
            <table className="w-full text-xs border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-2 py-2 text-left text-gray-700 font-bold border border-gray-300 whitespace-nowrap">Cód. Produto</th>
                  <th className="px-2 py-2 text-left text-gray-700 font-bold border border-gray-300">Produto</th>
                  <th className="px-2 py-2 text-left text-gray-700 font-bold border border-gray-300 whitespace-nowrap">Cor</th>
                  <th className="px-2 py-2 text-center text-gray-700 font-bold border border-gray-300">Tam.</th>
                  <th className="px-2 py-2 text-center text-gray-700 font-bold border border-gray-300 whitespace-nowrap">Qtd. Estoque</th>
                  <th className="px-2 py-2 text-center text-gray-700 font-bold border border-gray-300 whitespace-nowrap">Qtd. Pedido</th>
                  <th className="px-2 py-2 text-center text-gray-700 font-bold border border-gray-300 whitespace-nowrap">Nº Pedido</th>
                  <th className="px-2 py-2 text-left text-gray-700 font-bold border border-gray-300 hidden sm:table-cell print:table-cell">Cliente</th>
                  <th className="px-2 py-2 text-center text-gray-700 font-bold border border-gray-300 whitespace-nowrap">Retirado</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((group, gi) => (
                  <React.Fragment key={group.skuCode}>
                    {/* Linha separadora entre grupos */}
                    {gi > 0 && (
                      <tr>
                        <td colSpan={9} className="border-t-2 border-gray-400 p-0 h-0" />
                      </tr>
                    )}
                    {group.orders.map((order, oi) => (
                      <tr
                        key={`${group.skuCode}-${oi}`}
                        className={oi % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        {oi === 0 && (
                          <>
                            <td rowSpan={group.orders.length} className="px-2 py-1.5 text-xs font-mono font-semibold text-gray-800 border border-gray-200 align-middle whitespace-nowrap bg-gray-50">
                              {group.skuCode}
                            </td>
                            <td rowSpan={group.orders.length} className="px-2 py-1.5 text-xs text-gray-800 border border-gray-200 align-middle">
                              {group.productName}
                            </td>
                            <td rowSpan={group.orders.length} className="px-2 py-1.5 text-xs text-gray-700 border border-gray-200 align-middle whitespace-nowrap">
                              {group.cor}
                            </td>
                            <td rowSpan={group.orders.length} className="px-2 py-1.5 text-xs text-center text-gray-700 border border-gray-200 align-middle font-semibold">
                              {group.tamanho}
                            </td>
                            <td rowSpan={group.orders.length} className="px-2 py-1.5 text-xs text-center font-bold text-gray-900 border border-gray-200 align-middle">
                              {group.stockQty}
                            </td>
                          </>
                        )}
                        <td className="px-2 py-1.5 text-xs text-center font-bold text-gray-900 border border-gray-200">
                          {order.qty}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-center font-mono font-semibold text-blue-700 border border-gray-200 whitespace-nowrap">
                          #{order.orderNumber}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-gray-600 border border-gray-200 whitespace-nowrap hidden sm:table-cell print:table-cell">
                          {order.customerName}
                        </td>
                        <td className="px-2 py-1.5 text-center border border-gray-200">
                          <span className="inline-block w-4 h-4 border-2 border-gray-500 rounded-sm align-middle" />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            {/* Rodapé */}
            <div className="mt-4 pt-3 border-t border-gray-300 flex justify-between text-[10px] text-gray-400">
              <span>Total de unidades: <strong className="text-gray-700">{data.meta.totalQty}</strong></span>
              <span>Aura ERP · Ficha de Separação</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
