import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from './Input.jsx'

/**
 * PasswordInput — Aura UI
 *
 * Wrap em volta do Input com toggle de visibilidade (ícone de olho).
 * Aceita TODAS as props do Input (label, error, hint, disabled, etc).
 *
 * Comportamento:
 *   - Inicia oculto (type="password").
 *   - Clique no olho alterna entre password e text.
 *   - O botão é type="button" para nunca enviar form sem querer.
 *   - Acessível: aria-label muda conforme o estado.
 */
export const PasswordInput = React.forwardRef(function PasswordInput(
  { disabled = false, ...props },
  ref
) {
  const [visible, setVisible] = useState(false)

  const toggle = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setVisible(v => !v)
  }

  const Icon = visible ? EyeOff : Eye

  const endAdornment = (
    <button
      type="button"
      tabIndex={-1}
      onClick={toggle}
      disabled={disabled}
      aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
      aria-pressed={visible}
      className="
        w-7 h-7 flex items-center justify-center rounded
        text-[var(--color-text-muted)] hover:text-[var(--color-text)]
        focus:outline-none focus:text-[var(--color-text)]
        disabled:opacity-40 disabled:cursor-not-allowed
        transition-colors duration-150
      "
    >
      <Icon size={16} />
    </button>
  )

  return (
    <Input
      ref={ref}
      type={visible ? 'text' : 'password'}
      autoComplete={props.autoComplete ?? 'current-password'}
      disabled={disabled}
      endAdornment={endAdornment}
      {...props}
    />
  )
})

PasswordInput.displayName = 'PasswordInput'
