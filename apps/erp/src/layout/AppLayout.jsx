/**
 * layout/AppLayout.jsx
 *
 * Wrapper de layout para todas as páginas protegidas do ERP.
 *
 * Estrutura:
 *   <div root>
 *     <Sidebar />          ← desktop only (md+)
 *     <div column>
 *       <Header />
 *       <main>             ← conteúdo da página
 *         {children}
 *       </main>
 *     </div>
 *   </div>
 *   <BottomNav />          ← mobile only (< md)
 *
 * Responsabilidades:
 *   - Aplica ThemeProvider com tema do tenant buscado via useTenantTheme()
 *   - Injeta classes CSS de tema no <html> (via ThemeProvider já existente)
 *   - Passa tenantInfo para Sidebar e Header
 *   - Adiciona padding bottom no mobile para o bottom nav não sobrepor conteúdo
 *
 * Uso:
 *   Envolve o <Outlet /> dentro de <ProtectedRoute> via React Router.
 */

import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@aura/theme'
import { useTenantTheme } from '../hooks/useTenantTheme.js'
import { useAnalytics, trackPageView } from '../hooks/useAnalytics.js'
import { Sidebar }   from './Sidebar.jsx'
import { Header }    from './Header.jsx'
import { BottomNav } from './BottomNav.jsx'

/* Mapa path → chave i18n para o título do header */
const PAGE_TITLES = {
  '/dashboard':  'nav.dashboard',
  '/products':   'nav.products',
  '/inventory':  'nav.inventory',
  '/orders':     'nav.orders',
  '/customers':  'nav.customers',
  '/whatsapp':   'nav.whatsapp',
  '/settings':   'nav.settings',
  '/profile':    'nav.profile',
}

export function AppLayout() {
  const { t }                = useTranslation()
  const { setTenantTheme }   = useTheme()
  const { tenantTheme, tenantInfo } = useTenantTheme()

  // Injeta GA4 se o tenant configurou o ID
  useAnalytics(tenantInfo?.ga4MeasurementId ?? null)
  const location             = useLocation()

  // Rastreia mudanças de rota no GA4
  React.useEffect(() => {
    trackPageView(location.pathname, document.title)
  }, [location.pathname])

  /* Propaga tema do tenant para o ThemeProvider existente */
  React.useEffect(() => {
    if (tenantTheme) setTenantTheme(tenantTheme)
  }, [tenantTheme, setTenantTheme])

  /* Resolve título da página atual */
  const pageKey  = PAGE_TITLES[location.pathname]
  const pageTitle = pageKey ? t(pageKey) : undefined

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">

      {/* ── Sidebar (desktop) ── */}
      <Sidebar tenantInfo={tenantInfo} />

      {/* ── Coluna principal ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Header */}
        <Header tenantInfo={tenantInfo} pageTitle={pageTitle} />

        {/* Conteúdo */}
        <main className="
          flex-1 overflow-y-auto
          px-4 py-4 md:px-6 md:py-6
          pb-20 md:pb-6
        ">
          <Outlet />
        </main>
      </div>

      {/* ── Bottom nav (mobile) ── */}
      <BottomNav />
    </div>
  )
}
