/**
 * pages/whatsapp/WhatsappPage.jsx
 *
 * Painel WhatsApp — Sprint 2 Tarefa 7.
 *
 * Layout (responsivo):
 *
 * Mobile: abas (Status | Fila | Histórico | Enviar)
 * Desktop: grid 2 colunas
 *   Coluna esquerda : SessionCard + ManualSend
 *   Coluna direita  : tabs (Fila de aprovação | Histórico de mensagens)
 *
 * Badge de contagem na aba "Fila" quando há pedidos pendentes.
 */

import React, { useState } from 'react'
import { RefreshCw, Wifi, ShoppingCart, MessageSquare, Send } from 'lucide-react'
import { Card } from '@aura/ui'
import { SessionCard }    from './components/SessionCard.jsx'
import { PendingOrders }  from './components/PendingOrders.jsx'
import { MessageHistory } from './components/MessageHistory.jsx'
import { ManualSend }     from './components/ManualSend.jsx'
import { useWhatsapp }    from './useWhatsapp.js'

/* ─── Tab pill ─── */
function Tab({ label, icon: Icon, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium
        transition-colors duration-150
        ${active
          ? 'bg-[var(--color-primary)] text-white'
          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]'
        }
      `}
    >
      <Icon size={15} />
      {label}
      {badge > 0 && (
        <span className={`
          ml-0.5 inline-flex items-center justify-center
          w-4 h-4 rounded-full text-[10px] font-bold
          ${active ? 'bg-white/30 text-white' : 'bg-[var(--color-primary)] text-white'}
        `}>
          {badge}
        </span>
      )}
    </button>
  )
}

export function WhatsappPage() {
  const {
    session, qrCode, orders, messages,
    loading, sending, pendingCount,
    startSession, stopSession,
    reviewOrder, sendMessage, refetch,
  } = useWhatsapp()

  /* Tab state — mobile e painel direito desktop */
  const [mobileTab,  setMobileTab]  = useState('status')   // status|queue|history|send
  const [desktopTab, setDesktopTab] = useState('queue')    // queue|history

  return (
    <div className="space-y-5 max-w-screen-xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">WhatsApp</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            Painel de controle do bot e sessão WAHA
          </p>
        </div>
        <button
          onClick={refetch}
          disabled={loading.session}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] disabled:opacity-40 transition-colors"
          aria-label="Atualizar"
        >
          <RefreshCw size={16} className={loading.session ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ══════════════════════════════════
          MOBILE — abas
      ══════════════════════════════════ */}
      <div className="md:hidden">
        {/* Barra de abas */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          <Tab label="Status"    icon={Wifi}          active={mobileTab === 'status'}  onClick={() => setMobileTab('status')}  />
          <Tab label="Fila"      icon={ShoppingCart}  active={mobileTab === 'queue'}   onClick={() => setMobileTab('queue')}   badge={pendingCount} />
          <Tab label="Histórico" icon={MessageSquare} active={mobileTab === 'history'} onClick={() => setMobileTab('history')} />
          <Tab label="Enviar"    icon={Send}          active={mobileTab === 'send'}    onClick={() => setMobileTab('send')}    />
        </div>

        {mobileTab === 'status' && (
          <SessionCard
            session={session}
            qrCode={qrCode}
            loading={loading.session}
            onStart={startSession}
            onStop={stopSession}
          />
        )}
        {mobileTab === 'queue' && (
          <PendingOrders
            orders={orders}
            loading={loading.orders}
            onReview={reviewOrder}
          />
        )}
        {mobileTab === 'history' && (
          <Card className="p-4" style={{ minHeight: 400 }}>
            <MessageHistory messages={messages} loading={loading.messages} />
          </Card>
        )}
        {mobileTab === 'send' && (
          <Card className="p-4">
            <ManualSend onSend={sendMessage} sending={sending} />
          </Card>
        )}
      </div>

      {/* ══════════════════════════════════
          DESKTOP — grid 2 colunas
      ══════════════════════════════════ */}
      <div className="hidden md:grid md:grid-cols-5 gap-5">

        {/* ── Coluna esquerda: 2/5 ── */}
        <div className="md:col-span-2 space-y-5">
          <SessionCard
            session={session}
            qrCode={qrCode}
            loading={loading.session}
            onStart={startSession}
            onStop={stopSession}
          />
          <Card className="p-5">
            <p className="text-sm font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
              <Send size={15} className="text-[var(--color-primary)]" />
              Envio manual
            </p>
            <ManualSend onSend={sendMessage} sending={sending} />
          </Card>
        </div>

        {/* ── Coluna direita: 3/5 ── */}
        <div className="md:col-span-3">
          <Card className="p-5 flex flex-col" style={{ minHeight: 600 }}>
            {/* Tabs */}
            <div className="flex gap-1 mb-5 shrink-0">
              <Tab
                label="Fila de aprovação"
                icon={ShoppingCart}
                active={desktopTab === 'queue'}
                onClick={() => setDesktopTab('queue')}
                badge={pendingCount}
              />
              <Tab
                label="Histórico"
                icon={MessageSquare}
                active={desktopTab === 'history'}
                onClick={() => setDesktopTab('history')}
              />
            </div>

            {/* Conteúdo */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {desktopTab === 'queue' && (
                <PendingOrders
                  orders={orders}
                  loading={loading.orders}
                  onReview={reviewOrder}
                />
              )}
              {desktopTab === 'history' && (
                <div className="flex flex-col h-full">
                  <MessageHistory messages={messages} loading={loading.messages} />
                </div>
              )}
            </div>
          </Card>
        </div>

      </div>
    </div>
  )
}
