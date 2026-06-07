/**
 * apps/erp/src/main.jsx
 * Entry-point do ERP Aura — Sprint 2.
 *
 * Providers (fora → dentro):
 *   BrowserRouter → ThemeProvider → AuthProvider → ToastProvider → App
 *
 * Rotas protegidas usam <AppLayout> como wrapper de layout,
 * que internamente busca o tema do tenant e repassa ao ThemeProvider.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Tokens CSS base — deve ser o primeiro import de estilo
import '@aura/ui/styles/tokens.css'
import './index.css'

// i18n — init antes de qualquer render
import '@aura/i18n'

import { ThemeProvider }  from '@aura/theme'
import { ToastProvider }  from '@aura/ui'
import { AuthProvider }   from './auth/AuthContext.jsx'
import { ProtectedRoute } from './routes/ProtectedRoute.jsx'
import { AppLayout }      from './layout/AppLayout.jsx'
import { LoginPage }      from './pages/LoginPage.jsx'
import { DashboardPage }  from './pages/DashboardPage.jsx'
import { ProductsPage }       from './pages/products/ProductsPage.jsx'
import { ProductDetailPage }   from './pages/products/ProductDetailPage.jsx'
import { InventoryPage }  from './pages/inventory/InventoryPage.jsx'
import { OrdersPage }     from './pages/orders/OrdersPage.jsx'
import { CustomersPage }  from './pages/customers/CustomersPage.jsx'
import { WhatsappPage }   from './pages/whatsapp/WhatsappPage.jsx'
import { SettingsPage }   from './pages/settings/SettingsPage.jsx'
import { UsersPage }      from './pages/users/UsersPage.jsx'
import { ProfilePage }    from './pages/ProfilePage.jsx'
import { BillingPage }    from './pages/billing/BillingPage.jsx'
import { ReportsPage }    from './pages/reports/ReportsPage.jsx'
import { ReceivablesPage }  from './pages/receivables/ReceivablesPage.jsx'
import { StockPanelPage }   from './pages/inventory/StockPanelPage.jsx'
import { NotFoundPage, ForbiddenPage } from './pages/ErrorPages.jsx'

/* ─── Tema inicial (será sobrescrito pelo AppLayout via API) ─── */
const INITIAL_THEME = {
  primaryColor: '#0284C7',
  mood:         'light',
  fontPair:     'modern',
  radius:       'soft',
}

function App() {
  return (
    <Routes>
      {/* ── Rota pública ── */}
      <Route path="/login" element={<LoginPage />} />

      {/* ── Painel tela cheia (sem AppLayout) ── */}
      <Route element={<ProtectedRoute />}>
        <Route path="/stock-panel" element={<StockPanelPage />} />
      </Route>

      {/* ── Rotas protegidas com AppLayout ── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          {/* Redirect raiz → dashboard */}
          <Route index element={<Navigate to="/dashboard" replace />} />

          {/* Módulos — qualquer usuário autenticado */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/orders"    element={<OrdersPage />} />
          <Route path="/products"      element={<ProductsPage />} />
          <Route path="/products/:id"  element={<ProductDetailPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/profile"   element={<ProfilePage />} />

          {/* Módulos restritos */}
          <Route element={<ProtectedRoute roles={['admin', 'estoque']} />}>
            <Route path="/inventory" element={<InventoryPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['admin', 'operador']} />}>
            <Route path="/whatsapp" element={<WhatsappPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['admin', 'financeiro']} />}>
            <Route path="/reports"   element={<ReportsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['admin', 'financeiro']} />}>
            <Route path='/receivables' element={<ReceivablesPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/users"    element={<UsersPage />} />
            <Route path="/billing"  element={<BillingPage />} />
          </Route>
        </Route>
      </Route>

      {/* ── Erros ── */}
      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="*"    element={<NotFoundPage />} />
    </Routes>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider tenantTheme={INITIAL_THEME}>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
