import React from 'react'
import { cn } from '../cn.js'

/**
 * Skeleton — Aura UI
 *
 * Props:
 *   variant  : 'rect' | 'circle'   (default: 'rect')
 *   width    : string | number      (ex: '100%', 200)
 *   height   : string | number      (ex: 16, '2rem')
 *   className: string
 *
 * Uso:
 *   <Skeleton width="100%" height={16} />
 *   <Skeleton variant="circle" width={40} height={40} />
 */

function toPx(value) {
  if (value === undefined || value === null) return undefined
  return typeof value === 'number' ? `${value}px` : value
}

const Skeleton = React.forwardRef(function Skeleton(
  { variant = 'rect', width, height, className, style, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        'animate-pulse bg-[var(--color-surface)]',
        variant === 'circle'
          ? 'rounded-full'
          : 'rounded-[var(--radius-md)]',
        className
      )}
      style={{
        width:  toPx(width),
        height: toPx(height),
        ...style,
      }}
      {...props}
    />
  )
})

Skeleton.displayName = 'Skeleton'

export { Skeleton }
