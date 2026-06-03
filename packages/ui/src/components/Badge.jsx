import React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '../cn.js'

/**
 * Badge — Aura UI
 *
 * Variantes: default | success | warning | error
 * Tamanhos : sm | md  (default md)
 */

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1 font-medium',
    'rounded-[var(--radius-full)] border',
    'transition-colors duration-150',
    'select-none whitespace-nowrap',
  ],
  {
    variants: {
      variant: {
        default: [
          'bg-[var(--color-surface)] text-[var(--color-text)]',
          'border-[var(--color-border)]',
        ],
        success: [
          'bg-[var(--color-success-bg)] text-[var(--color-success-fg)]',
          'border-[var(--color-success)]',
        ],
        warning: [
          'bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)]',
          'border-[var(--color-warning)]',
        ],
        error: [
          'bg-[var(--color-error-bg)] text-[var(--color-error-fg)]',
          'border-[var(--color-error)]',
        ],
      },
      size: {
        sm: 'px-2   py-0.5 text-xs',
        md: 'px-2.5 py-1   text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

const Badge = React.forwardRef(function Badge(
  { className, variant, size, children, ...props },
  ref
) {
  return (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </span>
  )
})

Badge.displayName = 'Badge'

export { Badge, badgeVariants }
