/**
 * apps/master/src/main.jsx
 * Entry-point do painel master Aura Platform — Sprint 4 Tarefa 2
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import '@aura/ui/styles/tokens.css'
import './index.css'

import { Layout }           from './components/Layout.jsx'
import { DashboardPage }    from './pages/DashboardPage.jsx'
import { TenantsPage }      from './pages/TenantsPage.jsx'
import { TenantDetailPage } from './pages/TenantDetailPage.jsx'
import { CreateTenantPage } from './pages/CreateTenantPage.jsx'
import { BillingPage }      from './pages/BillingPage.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"   element={<DashboardPage />} />
          <Route path="/tenants"     element={<TenantsPage />} />
          <Route path="/tenants/new" element={<CreateTenantPage />} />
          <Route path="/tenants/:slug" element={<TenantDetailPage />} />
          <Route path="/billing"     element={<BillingPage />} />
          <Route path="*"            element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
