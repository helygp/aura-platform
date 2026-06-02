import React from 'react'
import { cn } from '../cn.js'

/**
 * Input — Aura UI
 *
 * Props:
 *   label       : string  — label visível acima do campo
 *   placeholder : string
 *   error       : string  — mensagem de erro (ativa estado de erro)
 *   hint        : string  — texto auxiliar abaixo do campo (substituído por error se existir)
 *   disabled    : boolean
 *   className   : string  — classes aplicadas no <input>
 *   wrapperClassName : string — classes aplicadas no wrapper externo
 */

const Input = React.forwardRef(function Input(
  {
    label,
    placeholder,
    error,
    hint,
    disabled = false,
    className,
    wrapperClassName,
    id,
    ...props
  },
  ref
) {
  // Gera id automático se não fornecido (acessibilidade)
  const inputId = id ?? React.useId()

  const hasError = Boolean(error)

  return (
    <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className={cn(
            'text-sm font-medium leading-none',
            disabled
              ? 'text-[var(--color-text-disabled)]'
              : 'text-[var(--color-text)]'
          )}
        >
          {label}
        </label>
      )}

      <input
        ref={ref}
        id={inputId}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cn(
          // base
          'h-10 w-full rounded-[var(--radius-md)] border px-3 text-sm',
          'bg-[var(--color-bg)] text-[var(--color-text)]',
          'placeholder:text-[var(--color-text-muted)]',
          'transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1',
          // estado normal
          !hasError && 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
          // estado erro
          hasError && 'border-[var(--color-error)] focus:ring-[var(--color-error)]',
          // disabled
          disabled && 'cursor-not-allowed opacity-50 bg-[var(--color-surface)]',
          className
        )}
        {...props}
      />

      {/* Mensagem de erro tem prioridade sobre hint */}
      {hasError && (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="text-xs text-[var(--color-error)] leading-tight"
        >
          {error}
        </p>
      )}

      {!hasError && hint && (
        <p
          id={`${inputId}-hint`}
          className="text-xs text-[var(--color-text-muted)] leading-tight"
        >
          {hint}
        </p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export { Input }
