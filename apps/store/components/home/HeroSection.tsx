/**
 * components/home/HeroSection.tsx
 * v2 — suporta heroLayout 'split' (protótipo Fast Malhas) e 'banner' (legado).
 */
import Link from 'next/link'
import type { TenantTheme } from '@/lib/tenant'

interface Props { theme: TenantTheme }

export default function HeroSection({ theme }: Props) {
  return theme.heroLayout === 'split'
    ? <HeroSplit theme={theme} />
    : <HeroBanner theme={theme} />
}

// ─── Split hero (novo padrão) ─────────────────────────────────────────────────

function HeroSplit({ theme }: Props) {
  // Stats: só exibe se o tenant configurar heroStats — sem fallback hardcoded
  const stats = theme.heroStats?.length ? theme.heroStats : []

  const props = theme.valueProps?.length
    ? theme.valueProps
    : [
        { icon: 'grid',   title: 'Grade na tabela',       desc: 'Cor × tamanho numa matriz. Veja o total de peças mudar em tempo real.' },
        { icon: 'repeat', title: 'Reposição em 1 clique', desc: 'Repita o último pedido inteiro e ajuste só o que precisar.'          },
      ]

  return (
    <>
      {/* ── Hero principal ── */}
      <section style={{ background: 'var(--bg)', paddingTop: 'clamp(40px,7vw,96px)', paddingBottom: 'var(--pad-sect)' }}>
        <div className="wrap" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 48, alignItems: 'center' }}
               className="hero-grid">
            {/* Texto */}
            <div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11.5, fontWeight: 600, letterSpacing: '.02em',
                padding: '4px 10px', borderRadius: 999,
                background: 'var(--brand-soft)', color: 'var(--brand-soft-ink)',
              }}>
                ⚡ Atacado para lojistas
              </span>

              <h1 style={{
                fontSize: 'clamp(34px,5vw,58px)', lineHeight: 1.06,
                letterSpacing: '-0.035em', margin: '20px 0 0',
                fontWeight: 800, color: 'var(--ink)',
              }}>
                {theme.heroTitle ?? (
                  <>Compre por <span style={{ color: 'var(--brand)' }}>grade</span>, não por unidade.</>
                )}
              </h1>

              {theme.heroSubtitle && (
                <p style={{
                  fontSize: 'clamp(16px,2.2vw,19px)', color: 'var(--ink-2)',
                  lineHeight: 1.6, margin: '22px 0 0', maxWidth: 460,
                }}>
                  {theme.heroSubtitle}
                </p>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 30, flexWrap: 'wrap' }}>
                <Link
                  href="/catalogo"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 9,
                    height: 54, padding: '0 28px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--brand)', color: 'var(--brand-ink)',
                    fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em',
                    textDecoration: 'none', border: '1px solid transparent',
                  }}
                >
                  {theme.heroCta ?? 'Ver catálogo'} →
                </Link>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 28, marginTop: 36, flexWrap: 'wrap' }}>
                {stats.map(({ value, label }) => (
                  <div key={label}>
                    <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
                      {value}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual lado direito — placeholder com badge */}
            <div style={{ position: 'relative' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
                borderRadius: 'var(--radius-lg)', overflow: 'hidden',
              }}>
                {[0, 1].map(i => (
                  <div key={i} style={{
                    transform: i === 1 ? 'translateY(28px)' : 'none',
                    aspectRatio: '3/4',
                    background: 'var(--surface-2)',
                    backgroundImage: 'repeating-linear-gradient(-45deg,transparent 0 11px,rgba(22,32,26,.04) 11px 12px)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--line)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 11, letterSpacing: '.04em',
                      textTransform: 'uppercase', color: 'var(--muted)',
                      background: 'var(--surface)', padding: '4px 9px',
                      borderRadius: 999, border: '1px solid var(--line)',
                    }}>
                      {theme.name}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{
                position: 'absolute', bottom: -6, left: -6,
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 14, padding: '12px 16px',
                boxShadow: 'var(--shadow)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{
                  width: 38, height: 38, borderRadius: 9,
                  background: 'var(--brand-soft)', color: 'var(--brand-soft-ink)',
                  display: 'grid', placeItems: 'center', fontSize: 18,
                }}>✓</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Grade fechada</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>1 clique preenche tudo</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Value props strip ── */}
      {props.length > 0 && (
        <section style={{ background: 'var(--bg)', paddingBottom: 'var(--pad-sect)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}
                 className="vp-grid">
              {props.map(({ icon, title, desc }) => (
                <div key={title} style={{
                  background: 'var(--surface)', border: '1px solid var(--line)',
                  borderRadius: 'var(--radius)', padding: 'var(--pad-card)',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  <span style={{
                    width: 42, height: 42, borderRadius: 11,
                    background: 'var(--brand-soft)', color: 'var(--brand-soft-ink)',
                    display: 'grid', placeItems: 'center', fontSize: 20,
                  }}>
                    {icon === 'grid' ? '⊞' : icon === 'bolt' ? '⚡' : '↻'}
                  </span>
                  <strong style={{ display: 'block', marginTop: 14, fontSize: 16.5, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
                    {title}
                  </strong>
                  <p style={{ fontSize: 14, lineHeight: 1.55, margin: '7px 0 0', color: 'var(--muted)' }}>
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <style>{`
        @media (max-width:980px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .vp-grid   { grid-template-columns: 1fr !important; }
        }
        @media (max-width:640px) {
          .wrap { padding: 0 16px !important; }
        }
      `}</style>
    </>
  )
}

// ─── Banner hero (legado — retrocompat) ──────────────────────────────────────

function HeroBanner({ theme }: Props) {
  const hasBanner = Boolean(theme.heroBannerUrl)
  return (
    <section className="relative overflow-hidden" style={{ minHeight: hasBanner ? '480px' : '380px' }}>
      {hasBanner ? (
        <>
          <img src={theme.heroBannerUrl!} alt="" aria-hidden
               className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        </>
      ) : (
        <div className="absolute inset-0" style={{
          background: `linear-gradient(135deg, var(--brand) 0%, color-mix(in srgb, var(--brand) 70%, transparent) 100%)`,
        }} />
      )}
      <div className="relative mx-auto flex max-w-7xl flex-col justify-center gap-5 px-4 py-20 sm:px-6 sm:py-28">
        <div className="max-w-xl">
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl"
              style={{ color: hasBanner ? '#fff' : 'var(--brand-ink)' }}>
            {theme.heroTitle ?? theme.name}
          </h1>
          {theme.heroSubtitle && (
            <p className="mt-3 text-base sm:text-lg"
               style={{ color: hasBanner ? 'rgba(255,255,255,0.85)' : 'var(--brand-ink)', opacity: .85 }}>
              {theme.heroSubtitle}
            </p>
          )}
          <Link href="/catalogo"
                className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius)] px-6 py-3 text-sm font-semibold shadow-lg transition-all hover:opacity-90 hover:shadow-xl active:scale-95"
                style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-ink)' }}>
            {theme.heroCta ?? 'Ver catálogo'} →
          </Link>
        </div>
      </div>
    </section>
  )
}
