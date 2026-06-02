/**
 * pages/whatsapp/components/ManualSend.jsx
 *
 * Formulário de envio manual de mensagem WhatsApp.
 * Campo de número (com máscara) + textarea de mensagem.
 * Feedback de sucesso/erro inline.
 *
 * Props:
 *   onSend   : ({ to, message }) => Promise<boolean>
 *   sending  : boolean
 */

import React, { useState } from 'react'
import { Send, CheckCircle2, AlertTriangle } from 'lucide-react'

function maskPhone(v = '') {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{4,5})(\d{4})$/, '$1-$2')
}

export function ManualSend({ onSend, sending }) {
  const [to,      setTo]      = useState('')
  const [message, setMessage] = useState('')
  const [status,  setStatus]  = useState(null) // 'ok' | 'error' | null
  const [error,   setError]   = useState('')

  const charCount = message.length
  const canSend   = to.replace(/\D/g,'').length >= 10 && message.trim().length > 0 && !sending

  const handleSubmit = async () => {
    if (!canSend) return
    setStatus(null)
    setError('')
    const rawPhone = to.replace(/\D/g,'')
    const ok = await onSend({ to: rawPhone, message: message.trim() })
    if (ok) {
      setStatus('ok')
      setMessage('')
      setTimeout(() => setStatus(null), 3000)
    } else {
      setStatus('error')
      setError('Não foi possível enviar a mensagem. Verifique a conexão.')
    }
  }

  const handleKeyDown = (e) => {
    // Ctrl+Enter envia
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="space-y-4">
      {/* Número */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
          Número WhatsApp
        </label>
        <input
          type="text"
          placeholder="(11) 99999-0000"
          value={to}
          onChange={e => setTo(maskPhone(e.target.value))}
          className="
            w-full h-10 px-3 rounded-lg text-sm
            bg-[var(--color-bg)] border border-[var(--color-border)]
            text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)]
            focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
          "
        />
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Somente números cadastrados como clientes.
        </p>
      </div>

      {/* Mensagem */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-[var(--color-text)]">Mensagem</label>
          <span className={`text-[10px] tabular-nums ${charCount > 900 ? 'text-[var(--color-error)]' : 'text-[var(--color-text-disabled)]'}`}>
            {charCount}/1000
          </span>
        </div>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value.slice(0, 1000))}
          onKeyDown={handleKeyDown}
          placeholder="Digite a mensagem… (Ctrl+Enter para enviar)"
          rows={4}
          className="
            w-full px-3 py-2.5 rounded-lg text-sm resize-none
            bg-[var(--color-bg)] border border-[var(--color-border)]
            text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)]
            focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
          "
        />
      </div>

      {/* Feedback */}
      {status === 'ok' && (
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2.5">
          <CheckCircle2 size={15} className="shrink-0" />
          Mensagem enviada com sucesso!
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5">
          <AlertTriangle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Botão */}
      <button
        onClick={handleSubmit}
        disabled={!canSend}
        className="
          w-full flex items-center justify-center gap-2
          h-10 rounded-lg text-sm font-semibold
          bg-[var(--color-primary)] text-white
          hover:bg-[var(--color-primary-hover)]
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-colors
        "
      >
        <Send size={15} />
        {sending ? 'Enviando…' : 'Enviar mensagem'}
      </button>
    </div>
  )
}
