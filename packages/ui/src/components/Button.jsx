import React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '../cn.js'

/**
 * Button — Aura UI
 *
 * Variantes : primary | secondary | ghost | destructive
 * Tamanhos  : sm | md | lg
 * asChild   : renderiza o children como elemento raiz (ex: <a>, <Link>)
 */

const buttonVariants = cva(
  // base
  [
    'inline-flex items-center justify-center gap-2 font-medium',
    'rounded-[var(--radius-md)] transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-40',
    'select-none whitespace-nowrap',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-[var(--color-primary)] text-[var(--color-primary-fg)]',
          'hover:bg-[var(--color-primary-hover)]',
          'shadow-[var(--shadow-sm)]',
        ],
        secondary: [
          'bg-[var(--color-surface)] text-[var(--color-text)]',
          'border border-[var(--color-border)]',
          'hover:bg-[var(--color-bg-subtle)] hover:border-[var(--color-border-strong)]',
        ],
        ghost: [
          'bg-transparent text-[var(--color-text)]',
          'hover:bg-[var(--color-surface)]',
        ],
        destructive: [
          'bg-[var(--color-error)] text-white',
          'hover:bg-red-700 dark:hover:bg-red-400',
          'shadow-[var(--shadow-sm)]',
        ],
      },
      size: {
        sm: 'h-8  px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

const Button = React.forwardRef(function Button(
  {
    className,
    variant,
    size,
    asChild = false,
    children,
    ...props
  },
  ref
) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </Comp>
  )
})

Button.displayName = 'Button'

export { Button, buttonVariants }
