/**
 * pages/whatsapp/components/PhoneInput.jsx
 *
 * Input de telefone com DDI fixo +55 (BR) e formatação automática.
 * Sempre emite número E.164 completo: 5511999999999
 */

import React, { useState } from 'react'

/** Formata dígitos para exibição: (11) 99999-9999 */
function fmt(digits = '') {
  const d = digits.slice(0, 11)
  if (d.length <= 2) return d ? `(${d}` : ''
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

/**
 * @param {object} props
 * @param {string}   props.value     – valor externo (dígitos sem DDI, ex: "11999999999")
 * @param {Function} props.onChange  – cb(e164string) ex: "5511999999999"
 * @param {string}   [props.placeholder]
 * @param {string}   [props.className]
 */
export function PhoneInput({ value = '', onChange, placeholder = '(11) 99999-9999', className = '' }) {
  // Normaliza entrada externa: remove DDI 55 se vier completo
  const toLocal = (v = '') => {
    const d = String(v).replace(/\D/g, '')
    if (d.startsWith('55') && d.length > 11) return d.slice(2)
    return d
  }

  const [local, setLocal] = useState(() => toLocal(value))

  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
    setLocal(digits)
    const e164 = digits.length >= 10 ? '55' + digits : ''
    onChange?.(e164)
  }

  return (
    <div className={`flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--color-primary)] ${className}`}>
      {/* DDI fixo */}
      <span className="flex items-center gap-1.5 px-3 h-9 text-sm text-[var(--color-text-muted)] border-r border-[var(--color-border)] bg-[var(--color-surface)] shrink-0 select-none">
        🇧🇷 +55
      </span>
      <input
        type="tel"
        inputMode="numeric"
        placeholder={placeholder}
        value={fmt(local)}
        onChange={handleChange}
        className="flex-1 h-9 px-3 text-sm bg-transparent text-[var(--color-text)] focus:outline-none"
      />
    </div>
  )
}
