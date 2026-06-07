/**
 * components/order/OrderTimeline.tsx
 * Timeline visual do pedido — progresso vertical com ícones por etapa.
 * RSC-safe.
 */

type TimelineEntry = { status: string; at: string | null }

interface Props {
  timeline: TimelineEntry[]
  currentStatus: string
  isCancelled: boolean
}

const FLOW = [
  { key: 'pendente', label: 'Pedido recebido',     icon: ReceiptIcon },
  { key: 'confirmado',             label: 'Confirmado',          icon: CheckCircleIcon },
  { key: 'separando',           label: 'Em separação',        icon: BoxIcon },
  { key: 'enviado',                label: 'Enviado',             icon: TruckIcon },
  { key: 'entregue',               label: 'Entregue',            icon: HomeIcon },
]

export default function OrderTimeline({ timeline, currentStatus, isCancelled }: Props) {
  const doneKeys = new Set(timeline.map((t) => statusKey(t.status)))

  if (isCancelled) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius)] border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/30">
        <CancelIcon />
        <p className="text-sm font-medium text-red-700 dark:text-red-400">
          Este pedido foi cancelado.
        </p>
      </div>
    )
  }

  return (
    <ol className="flex flex-col gap-0">
      {FLOW.map((step, idx) => {
        const isDone    = doneKeys.has(step.key)
        const isCurrent = currentStatus === step.key
        const entry     = timeline.find((t) => statusKey(t.status) === step.key)
        const isLast    = idx === FLOW.length - 1

        return (
          <li key={step.key} className="flex gap-4">

            {/* Coluna esquerda: ícone + linha */}
            <div className="flex flex-col items-center">
              <div
                className={[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition',
                  isDone || isCurrent
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground',
                ].join(' ')}
              >
                <step.icon />
              </div>
              {!isLast && (
                <div
                  className={[
                    'mt-1 w-0.5 flex-1 min-h-[1.5rem]',
                    isDone ? 'bg-primary' : 'bg-border',
                  ].join(' ')}
                />
              )}
            </div>

            {/* Coluna direita: texto */}
            <div className="pb-6 pt-1.5">
              <p
                className={[
                  'text-sm font-semibold',
                  isDone || isCurrent ? 'text-foreground' : 'text-muted-foreground',
                ].join(' ')}
              >
                {step.label}
                {isCurrent && !isDone && (
                  <span className="ml-2 inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-primary align-middle" />
                )}
              </p>
              {entry?.at && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDate(entry.at)}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusKey(label: string): string {
  // Converte label PT para chave — ex: "Aguardando confirmação" → "aguardando_confirmacao"
  const map: Record<string, string> = {
    'Pedido recebido':        'pendente',
    'Aguardando confirmação': 'pendente',
    'Confirmado':             'confirmado',
    'Em separação':           'separando',
    'Enviado':                'enviado',
    'Entregue':               'entregue',
  }
  return map[label] ?? label.toLowerCase().replace(/\s+/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

// ─── Ícones ───────────────────────────────────────────────────────────────────

function ReceiptIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M14 8H8M16 12H8M11 16H8"/></svg>
}
function CheckCircleIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
}
function BoxIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>
}
function TruckIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg>
}
function HomeIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
}
function CancelIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-red-500"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
}
