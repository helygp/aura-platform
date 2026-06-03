'use client'

/**
 * components/product/QuantityInput.tsx
 * Input de quantidade com botões +/− e validação de estoque.
 */

interface Props {
  value: number
  max: number
  onChange: (v: number) => void
}

export default function QuantityInput({ value, max, onChange }: Props) {
  function dec() { if (value > 1) onChange(value - 1) }
  function inc() { if (value < max) onChange(value + 1) }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const n = Math.max(1, Math.min(max, Number(e.target.value) || 1))
    onChange(n)
  }

  return (
    <div className="flex items-center rounded-[var(--radius)] border border-border bg-card">
      <button
        onClick={dec}
        disabled={value <= 1}
        className="flex h-10 w-10 items-center justify-center text-lg text-muted-foreground transition hover:text-foreground disabled:opacity-30"
        aria-label="Diminuir quantidade"
      >
        −
      </button>

      <input
        type="number"
        min={1}
        max={max}
        value={value}
        onChange={handleChange}
        className="w-12 bg-transparent text-center text-sm font-semibold text-foreground focus:outline-none"
        aria-label="Quantidade"
      />

      <button
        onClick={inc}
        disabled={value >= max}
        className="flex h-10 w-10 items-center justify-center text-lg text-muted-foreground transition hover:text-foreground disabled:opacity-30"
        aria-label="Aumentar quantidade"
      >
        +
      </button>
    </div>
  )
}
