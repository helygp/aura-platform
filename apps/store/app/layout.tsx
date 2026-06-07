/**
 * app/layout.tsx
 * Tarefa 2 — Tema aplicado por SSR antes do HTML chegar no cliente.
 * Tarefa 9 — GA4 + Meta Pixel injetados por tenant (SSR, sem flash).
 *
 * Fluxo:
 *   middleware → injeta x-tenant-slug no header da request
 *   layout (RSC) → lê x-tenant-slug → busca tema na API (cache 60s)
 *   → gera CSS vars inline no <head> → zero flash de estilo
 *   → injeta GA4 / Meta Pixel condicionalmente pelo tenant config
 */

import type { Metadata } from 'next'
import { headers } from 'next/headers'
import {
  fetchTenantTheme,
  buildThemeCssVars,
  DEFAULT_THEME,
  type TenantTheme,
} from '@/lib/tenant'
import TenantProvider from '@/components/layout/TenantProvider'
import './globals.css'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getTenantTheme(): Promise<TenantTheme> {
  const headersList = headers()
  const slug = headersList.get('x-tenant-slug') ?? 'demo'
  return (await fetchTenantTheme(slug)) ?? DEFAULT_THEME
}

// ─── Metadata dinâmica ────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTenantTheme()

  return {
    title: {
      default: theme.name,
      template: `%s | ${theme.name}`,
    },
    description: theme.heroSubtitle ?? `Catálogo B2B de ${theme.name}`,
    icons: theme.faviconUrl
      ? { icon: theme.faviconUrl, shortcut: theme.faviconUrl }
      : undefined,
    openGraph: {
      siteName: theme.name,
      locale: 'pt_BR',
      type: 'website',
    },
  }
}

// ─── GA4 Script ───────────────────────────────────────────────────────────────

function GA4Script({ measurementId }: { measurementId: string }) {
  if (!measurementId || !measurementId.startsWith('G-')) return null
  return (
    <>
      <script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}', {
  page_path: window.location.pathname,
  anonymize_ip: true,
  cookie_flags: 'SameSite=None;Secure'
});`,
        }}
      />
    </>
  )
}

// ─── Meta Pixel Script ────────────────────────────────────────────────────────

function MetaPixelScript({ pixelId }: { pixelId: string }) {
  if (!pixelId || !/^\d+$/.test(pixelId)) return null
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');`,
        }}
      />
      <noscript
        dangerouslySetInnerHTML={{
          __html: `<img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/>`,
        }}
      />
    </>
  )
}

// ─── Layout raiz ──────────────────────────────────────────────────────────────

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getTenantTheme()
  const cssVars = buildThemeCssVars(theme)

  // URL da fonte para Google Fonts (preconnect + stylesheet)
  const needsGoogleFont = theme.fontSans && !['system-ui', 'sans-serif'].includes(theme.fontSans)
  const fontFamily = encodeURIComponent(theme.fontSans)

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/*
         * CSS vars do tenant ANTES de qualquer stylesheet externo.
         * Isso garante que Tailwind e o resto do CSS já enxergam as vars corretas
         * na primeira pintura — sem FOUC.
         */}
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{${cssVars}}`,
          }}
        />

        {/* Fonte do tenant via Google Fonts */}
        {needsGoogleFont && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link
              rel="stylesheet"
              href={`https://fonts.googleapis.com/css2?family=${fontFamily}:wght@400;500;600;700;800&display=swap`}
            />
          </>
        )}

        {/* ── GA4 — injetado apenas se o tenant configurou o ID ── */}
        {theme.ga4MeasurementId && (
          <GA4Script measurementId={theme.ga4MeasurementId} />
        )}

        {/* ── Meta Pixel — injetado apenas se o tenant configurou o ID ── */}
        {theme.metaPixelId && (
          <MetaPixelScript pixelId={theme.metaPixelId} />
        )}
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <TenantProvider theme={theme}>
          {children}
        </TenantProvider>
      </body>
    </html>
  )
}
