import React from 'react'

export function Spinner({ size = 20 }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)] animate-spin"
    />
  )
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner size={32} />
    </div>
  )
}
