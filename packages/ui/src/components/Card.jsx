import React from 'react'
import { cn } from '../cn.js'

/**
 * Card — Aura UI
 *
 * Composição:
 *   <Card>
 *     <Card.Header>  — opcional
 *     <Card.Body>    — opcional (mas recomendado)
 *     <Card.Footer>  — opcional
 *   </Card>
 *
 * Ou uso flat: <Card className="p-6">...</Card>
 */

const Card = React.forwardRef(function Card({ className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-[var(--radius-lg)] border border-[var(--color-border)]',
        'bg-[var(--color-bg)] text-[var(--color-text)]',
        'shadow-[var(--shadow-sm)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})

const CardHeader = React.forwardRef(function CardHeader({ className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col gap-1 px-6 py-4',
        'border-b border-[var(--color-border)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})

const CardTitle = React.forwardRef(function CardTitle({ className, children, ...props }, ref) {
  return (
    <h3
      ref={ref}
      className={cn('text-base font-semibold leading-snug tracking-tight', className)}
      {...props}
    >
      {children}
    </h3>
  )
})

const CardDescription = React.forwardRef(function CardDescription({ className, children, ...props }, ref) {
  return (
    <p
      ref={ref}
      className={cn('text-sm text-[var(--color-text-muted)]', className)}
      {...props}
    >
      {children}
    </p>
  )
})

const CardBody = React.forwardRef(function CardBody({ className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn('px-6 py-4', className)}
      {...props}
    >
      {children}
    </div>
  )
})

const CardFooter = React.forwardRef(function CardFooter({ className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-2 px-6 py-4',
        'border-t border-[var(--color-border)]',
        'bg-[var(--color-bg-subtle)] rounded-b-[var(--radius-lg)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})

Card.displayName       = 'Card'
CardHeader.displayName = 'Card.Header'
CardTitle.displayName  = 'Card.Title'
CardDescription.displayName = 'Card.Description'
CardBody.displayName   = 'Card.Body'
CardFooter.displayName = 'Card.Footer'

// Sub-componentes acessíveis via Card.Header, Card.Body, etc.
Card.Header      = CardHeader
Card.Title       = CardTitle
Card.Description = CardDescription
Card.Body        = CardBody
Card.Footer      = CardFooter

export { Card, CardHeader, CardTitle, CardDescription, CardBody, CardFooter }
