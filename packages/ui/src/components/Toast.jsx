import React, { createContext, useContext, useCallback, useState } from 'react'
import * as RadixToast from '@radix-ui/react-toast'
import { cn } from '../cn.js'

/**
 * Toast — Aura UI
 *
 * Uso:
 *   1. Envolva o app com <ToastProvider>
 *   2. Use o hook useToast() para disparar toasts:
 *
 *   const { toast } = useToast()
 *   toast({ variant: 'success', title: 'Salvo!', description: 'Dados salvos.' })
 *
 * Variantes: success | error | warning | info
 * Auto-dismiss: 4000ms (configurável via duration)
 */

/* ─── Contexto ─── */
const ToastContext = createContext(null)

let _id = 0

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback(({ variant = 'info', title, description, duration = 4000 }) => {
    const id = ++_id
    setToasts(prev => [...prev, { id, variant, title, description, duration, open: true }])
  }, [])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, open: false } : t))
  }, [])

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      <RadixToast.Provider swipeDirection="right">
        {children}

        {toasts.map(t => (
          <ToastItem
            key={t.id}
            {...t}
            onDismiss={() => dismiss(t.id)}
            onAnimationEnd={() => !t.open && remove(t.id)}
          />
        ))}

        <RadixToast.Viewport
          className={cn(
            'fixed bottom-4 right-4 z-[100]',
            'flex flex-col gap-2 w-[360px] max-w-[calc(100vw-2rem)]',
            'outline-none'
          )}
        />
      </RadixToast.Provider>
    </ToastContext.Provider>
  )
}

/* ─── Mapa visual por variante ─── */
const variantMap = {
  success: {
    bar:   'bg-[var(--color-success)]',
    icon:  '✓',
    iconBg: 'bg-[var(--color-success-bg)] text-[var(--color-success-fg)]',
    title: 'text-[var(--color-success-fg)] dark:text-[var(--color-success)]',
  },
  error: {
    bar:   'bg-[var(--color-error)]',
    icon:  '✕',
    iconBg: 'bg-[var(--color-error-bg)] text-[var(--color-error-fg)]',
    title: 'text-[var(--color-error-fg)] dark:text-[var(--color-error)]',
  },
  warning: {
    bar:   'bg-[var(--color-warning)]',
    icon:  '!',
    iconBg: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)]',
    title: 'text-[var(--color-warning-fg)] dark:text-[var(--color-warning)]',
  },
  info: {
    bar:   'bg-[var(--color-primary)]',
    icon:  'i',
    iconBg: 'bg-[var(--color-surface)] text-[var(--color-primary)]',
    title: 'text-[var(--color-text)]',
  },
}

/* ─── Item individual ─── */
function ToastItem({ id, open, variant, title, description, duration, onDismiss, onAnimationEnd }) {
  const v = variantMap[variant] ?? variantMap.info

  return (
    <RadixToast.Root
      open={open}
      duration={duration}
      onOpenChange={(isOpen) => { if (!isOpen) onDismiss() }}
      onAnimationEnd={onAnimationEnd}
      className={cn(
        'relative flex items-start gap-3 overflow-hidden',
        'rounded-[var(--radius-md)] border border-[var(--color-border)]',
        'bg-[var(--color-bg)] shadow-[var(--shadow-md)]',
        'px-4 py-3',
        // animações Radix
        'data-[state=open]:animate-in data-[state=open]:slide-in-from-right-full',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full',
        'data-[swipe=move]:translate-x-[--radix-toast-swipe-move-x]',
        'data-[swipe=end]:animate-out data-[swipe=end]:slide-out-to-right-full',
        'transition-all duration-200'
      )}
    >
      {/* Barra lateral colorida */}
      <span className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-[var(--radius-md)]', v.bar)} />

      {/* Ícone */}
      <span className={cn(
        'mt-0.5 ml-2 flex h-5 w-5 shrink-0 items-center justify-center',
        'rounded-full text-xs font-bold',
        v.iconBg
      )}>
        {v.icon}
      </span>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        {title && (
          <RadixToast.Title className={cn('text-sm font-semibold leading-snug', v.title)}>
            {title}
          </RadixToast.Title>
        )}
        {description && (
          <RadixToast.Description className="mt-0.5 text-xs text-[var(--color-text-muted)] leading-relaxed">
            {description}
          </RadixToast.Description>
        )}
      </div>

      {/* Fechar */}
      <RadixToast.Close
        aria-label="Fechar"
        onClick={onDismiss}
        className={cn(
          'ml-auto shrink-0 mt-0.5',
          'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
          'text-base leading-none transition-colors'
        )}
      >
        ×
      </RadixToast.Close>
    </RadixToast.Root>
  )
}

/* ─── Hook ─── */
function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>')
  return ctx
}

export { ToastProvider, useToast }
