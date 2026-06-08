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
 *
 * NOTA: pageTitle foi removido do Header — o título já existe em cada
 * página individualmente; o espaço esquerdo do header é agora usado para
 * atalhos globais (Cockpit, etc.).
 */

import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTheme } from '@aura/theme'
import { useTenantTheme } from '../hooks/useTenantTheme.js'
import { useAnalytics, trackPageView } from '../hooks/useAnalytics.js'
import { Sidebar }   from './Sidebar.jsx'
import { Header }    from './Header.jsx'
import { BottomNav } from './BottomNav.jsx'

export function AppLayout() {
  const { setTenantTheme }   = useTheme()
  const { tenantTheme, tenantInfo } = useTenantTheme()

  // Injeta GA4 se o tenant configurou o ID
  useAnalytics(tenantInfo?.ga4MeasurementId ?? null)
  const location = useLocation()

  // Rastreia mudanças de rota no GA4
  React.useEffect(() => {
    trackPageView(location.pathname, document.title)
  }, [location.pathname])

  /* Propaga tema do tenant para o ThemeProvider existente */
  React.useEffect(() => {
    if (tenantTheme) setTenantTheme(tenantTheme)
  }, [tenantTheme, setTenantTheme])

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">

      {/* ── Sidebar (desktop) ── */}
      <Sidebar tenantInfo={tenantInfo} />

      {/* ── Coluna principal ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Header */}
        <Header tenantInfo={tenantInfo} />

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
