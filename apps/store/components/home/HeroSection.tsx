/**
 * components/home/HeroSection.tsx
 * Hero configurável — banner + título + CTA.
 * Configurado pelo dono no painel ERP (heroTitle, heroSubtitle, heroCta, heroBannerUrl).
 * RSC — sem 'use client'.
 */
import Link from 'next/link'
import type { TenantTheme } from '@/lib/tenant'

interface Props {
  theme: TenantTheme
}

export default function HeroSection({ theme }: Props) {
  const hasBanner = Boolean(theme.heroBannerUrl)

  return (
    <section
      className="relative overflow-hidden"
      style={{ minHeight: hasBanner ? '480px' : '380px' }}
    >
      {/* Fundo: banner ou gradiente da cor primária */}
      {hasBanner ? (
        <>
          <img
            src={theme.heroBannerUrl!}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Overlay para legibilidade do texto */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 70%, transparent) 100%)`,
          }}
        />
      )}

      {/* Conteúdo */}
      <div className="relative mx-auto flex max-w-7xl flex-col justify-center gap-5 px-4 py-20 sm:px-6 sm:py-28">
        <div className="max-w-xl">
          <h1
            className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl"
            style={{ color: hasBanner ? '#fff' : 'var(--color-primary-foreground)' }}
          >
            {theme.heroTitle ?? theme.name}
          </h1>

          {theme.heroSubtitle && (
            <p
              className="mt-3 text-base sm:text-lg"
              style={{
                color: hasBanner
                  ? 'rgba(255,255,255,0.85)'
                  : 'color-mix(in srgb, var(--color-primary-foreground) 80%, transparent)',
              }}
            >
              {theme.heroSubtitle}
            </p>
          )}

          <Link
            href="/catalogo"
            className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius)] px-6 py-3 text-sm font-semibold shadow-lg transition-all hover:opacity-90 hover:shadow-xl active:scale-95"
            style={
              hasBanner
                ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }
                : { backgroundColor: 'var(--color-primary-foreground)', color: 'var(--color-primary)' }
            }
          >
            {theme.heroCta ?? 'Ver catálogo'}
            <ArrowRightIcon />
          </Link>
        </div>
      </div>
    </section>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}
