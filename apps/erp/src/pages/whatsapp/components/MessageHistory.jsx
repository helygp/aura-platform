/**
 * pages/whatsapp/components/MessageHistory.jsx
 *
 * Histórico de mensagens trocadas com o bot.
 * Agrupa por contato, mostra conversa em balões (bot = direita, cliente = esquerda).
 * Seletor de contato no topo para filtrar a conversa.
 *
 * Props:
 *   messages : array de { id, from, text, phone, contactName, at }
 *   loading  : boolean
 */

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Bot, User } from 'lucide-react'
import { Skeleton } from '@aura/ui'
import { fmtTime } from '../whatsappTypes.js'

function Bubble({ msg }) {
  const isBot = msg.from === 'bot'
  return (
    <div className={`flex items-end gap-2 ${isBot ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-0.5 ${isBot ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'}`}>
        {isBot ? <Bot size={13} /> : <User size={13} />}
      </div>
      {/* Balão */}
      <div className={`
        max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-snug
        ${isBot
          ? 'bg-[var(--color-primary)] text-white rounded-br-sm'
          : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-bl-sm'
        }
      `}>
        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
        <p className={`text-[10px] mt-1 text-right ${isBot ? 'text-white/60' : 'text-[var(--color-text-disabled)]'}`}>
          {fmtTime(msg.at)}
        </p>
      </div>
    </div>
  )
}

export function MessageHistory({ messages, loading }) {
  const [selectedPhone, setSelectedPhone] = useState(null)
  const bottomRef = useRef(null)

  /* Lista de contatos únicos */
  const contacts = useMemo(() => {
    const seen  = new Set()
    const list  = []
    messages.forEach(m => {
      if (!seen.has(m.phone)) {
        seen.add(m.phone)
        list.push({ phone: m.phone, name: m.contactName ?? m.phone })
      }
    })
    return list
  }, [messages])

  /* Seleciona primeiro contato por padrão */
  useEffect(() => {
    if (contacts.length && !selectedPhone) {
      setSelectedPhone(contacts[0].phone)
    }
  }, [contacts, selectedPhone])

  /* Mensagens do contato selecionado, ordem cronológica */
  const filtered = useMemo(() =>
    messages
      .filter(m => m.phone === selectedPhone)
      .sort((a, b) => new Date(a.at) - new Date(b.at)),
  [messages, selectedPhone])

  /* Scroll para baixo quando muda de contato ou chega mensagem */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [filtered.length, selectedPhone])

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`flex items-end gap-2 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
            <Skeleton variant="circle" width={24} height={24} />
            <Skeleton width={i % 2 === 0 ? '55%' : '65%'} height={44} className="rounded-2xl" />
          </div>
        ))}
      </div>
    )
  }

  if (!contacts.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
        <Bot size={28} className="text-[var(--color-text-disabled)]" />
        <p className="text-sm text-[var(--color-text-muted)]">Nenhuma mensagem ainda.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Seletor de contato */}
      <div className="flex gap-2 flex-wrap mb-3 shrink-0">
        {contacts.map(c => (
          <button
            key={c.phone}
            onClick={() => setSelectedPhone(c.phone)}
            className={`
              h-7 px-3 rounded-full text-xs font-medium border transition-colors
              ${selectedPhone === c.phone
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                : 'bg-[var(--color-bg-subtle)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]'
              }
            `}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Balões */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {filtered.map(msg => <Bubble key={msg.id} msg={msg} />)}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
