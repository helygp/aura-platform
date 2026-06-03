'use client'

/**
 * components/product/ImageGallery.tsx
 * Galeria de fotos do produto.
 * - Desktop: thumbnails laterais + imagem principal
 * - Mobile: swipe horizontal nativo (scroll-snap)
 * Client Component — estado do índice ativo.
 */

import { useState, useRef } from 'react'

interface Props {
  images: string[]
  productName: string
}

export default function ImageGallery({ images, productName }: Props) {
  const [active, setActive] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)

  // Fallback quando não há imagens
  const imgs = images.length > 0 ? images : [null]

  // Swipe via scroll-snap — sincroniza índice ao scroll
  function handleScroll() {
    if (!trackRef.current) return
    const el = trackRef.current
    const idx = Math.round(el.scrollLeft / el.offsetWidth)
    setActive(idx)
  }

  function goTo(idx: number) {
    setActive(idx)
    if (trackRef.current) {
      trackRef.current.scrollTo({ left: idx * trackRef.current.offsetWidth, behavior: 'smooth' })
    }
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row-reverse">

      {/* ── Imagem principal + swipe track (mobile) ── */}
      <div className="relative flex-1 overflow-hidden rounded-[var(--radius-lg)] bg-muted">

        {/* Track com scroll-snap — mobile swipe */}
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none md:block"
          style={{ scrollbarWidth: 'none' }}
        >
          {imgs.map((src, i) => (
            <div
              key={i}
              className="aspect-square w-full shrink-0 snap-start"
            >
              {src ? (
                <img
                  src={src}
                  alt={`${productName} — foto ${i + 1}`}
                  className="h-full w-full object-cover"
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
              ) : (
                <PlaceholderImg />
              )}
            </div>
          ))}
        </div>

        {/* Dots mobile (quando múltiplas fotos) */}
        {imgs.length > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 md:hidden">
            {imgs.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={[
                  'h-1.5 rounded-full transition-all',
                  i === active ? 'w-4 bg-primary' : 'w-1.5 bg-white/60',
                ].join(' ')}
                aria-label={`Foto ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Setas desktop (quando múltiplas fotos) */}
        {imgs.length > 1 && (
          <>
            <button
              onClick={() => goTo(Math.max(0, active - 1))}
              disabled={active === 0}
              className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-card/90 p-1.5 shadow transition hover:bg-card disabled:opacity-30 md:flex"
              aria-label="Foto anterior"
            >
              <ChevronLeft />
            </button>
            <button
              onClick={() => goTo(Math.min(imgs.length - 1, active + 1))}
              disabled={active === imgs.length - 1}
              className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-card/90 p-1.5 shadow transition hover:bg-card disabled:opacity-30 md:flex"
              aria-label="Próxima foto"
            >
              <ChevronRight />
            </button>
          </>
        )}
      </div>

      {/* ── Thumbnails (desktop) ── */}
      {imgs.length > 1 && (
        <div className="hidden flex-col gap-2 md:flex md:w-20">
          {imgs.map((src, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={[
                'aspect-square w-full overflow-hidden rounded-[var(--radius)] border-2 transition',
                i === active ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100',
              ].join(' ')}
            >
              {src ? (
                <img src={src} alt={`Thumb ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <PlaceholderIcon />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Ícones e placeholders ─────────────────────────────────────────────────────

function PlaceholderImg() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.75" className="text-border">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    </div>
  )
}

function PlaceholderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-border">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  )
}

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
