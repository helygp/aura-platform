/**
 * layout/Sidebar.jsx
 *
 * Sidebar desktop — visível apenas em md+.
 * Colapsa para ícones (w-16) ou expande com texto (w-56).
 * Estado de colapso persistido em localStorage.
 * Itens com newTab:true abrem em nova aba.
 *
 * Props:
 *   tenantInfo : { name, logoUrl }
 */

import React, { useState, useCallback } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Package, Warehouse, ShoppingCart, UserCog,
  Users, MessageCircle, Settings, CreditCard, BarChart2, Wallet, ChevronLeft,
  ChevronRight, LogOut, Monitor,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { NAV_ITEMS } from './navItems.js'
import { VersionBadge } from '../components/WhatsNew.jsx'

/* ─── Mapa ícone → componente ─── */
const ICONS = {
  LayoutDashboard, Package, Warehouse, ShoppingCart, UserCog,
  Users, MessageCircle, Settings, CreditCard, BarChart2, Wallet, Monitor,
}

const SIDEBAR_KEY = 'aura-sidebar-collapsed'

function readCollapsed() {
  try { return localStorage.getItem(SIDEBAR_KEY) === 'true' } catch { return false }
}

/* Classes compartilhadas para os itens de nav */
const NAV_CLS_BASE = `
  flex items-center gap-3 rounded-lg px-3 py-2.5
  text-sm font-medium transition-colors duration-150
  text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]
`

export function Sidebar({ tenantInfo }) {
  const { t }              = useTranslation()
  const { user, logout, hasRole } = useAuth()
  const navigate           = useNavigate()
  const [collapsed, setCollapsed] = useState(readCollapsed)

  const toggleCollapse = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem(SIDEBAR_KEY, String(next)) } catch {}
      return next
    })
  }, [])

  const handleLogout = useCallback(async () => {
    await logout()
    navigate('/login', { replace: true })
  }, [logout, navigate])

  /* Filtra itens pelo papel do usuário */
  const visibleItems = NAV_ITEMS.filter(item =>
    item.roles === null || (user && hasRole(...item.roles))
  )

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 224 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="
        hidden md:flex flex-col
        h-screen sticky top-0
        bg-[var(--color-surface)] border-r border-[var(--color-border)]
        overflow-hidden shrink-0 z-30
      "
    >
      {/* ── Logo / nome ── */}
      <div className="flex items-center gap-3 h-16 px-4 border-b border-[var(--color-border)] shrink-0">
        {tenantInfo?.logoUrl ? (
          <img
            src={tenantInfo.logoUrl}
            alt={tenantInfo.name}
            className="w-8 h-8 rounded object-contain shrink-0"
          />
        ) : (
          <div className="
            w-8 h-8 rounded flex items-center justify-center shrink-0
            bg-[var(--color-primary)] text-white text-xs font-bold
          ">
            {(tenantInfo?.name ?? 'A').charAt(0).toUpperCase()}
          </div>
        )}
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="text-sm font-semibold text-[var(--color-text-primary)] truncate"
            >
              {tenantInfo?.name ?? 'Aura Platform'}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Itens de navegação ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {visibleItems.map(item => {
          const Icon = ICONS[item.icon]

          const labelNode = (
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="truncate"
                >
                  {t(`nav.${item.key}`)}
                </motion.span>
              )}
            </AnimatePresence>
          )

          /* newTab: abre em nova aba com <a> simples */
          if (item.newTab) {
            return (
              <a
                key={item.key}
                href={item.path}
                target="_blank"
                rel="noopener noreferrer"
                className={NAV_CLS_BASE}
                title={collapsed ? t(`nav.${item.key}`) : undefined}
              >
                <Icon size={20} className="shrink-0" />
                {labelNode}
              </a>
            )
          }

          return (
            <NavLink
              key={item.key}
              to={item.path}
              className={({ isActive }) => `
                flex items-center gap-3 rounded-lg px-3 py-2.5
                text-sm font-medium transition-colors duration-150
                ${isActive
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
                }
              `}
              title={collapsed ? t(`nav.${item.key}`) : undefined}
            >
              <Icon size={20} className="shrink-0" />
              {labelNode}
            </NavLink>
          )
        })}
      </nav>

      {/* ── Rodapé: usuário + logout ── */}
      <div className="border-t border-[var(--color-border)] p-2 space-y-1 shrink-0">
        {/* Avatar + nome */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="
            w-7 h-7 rounded-full flex items-center justify-center shrink-0
            bg-[var(--color-primary-muted)] text-[var(--color-primary)]
            text-xs font-bold
          ">
            {(user?.name ?? user?.email ?? 'U').charAt(0).toUpperCase()}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                  {user?.name ?? user?.email}
                </p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] truncate capitalize">
                  {user?.role}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Botão logout */}
        <button
          onClick={handleLogout}
          className="
            w-full flex items-center gap-3 rounded-lg px-3 py-2.5
            text-sm font-medium text-[var(--color-text-secondary)]
            hover:bg-red-50 hover:text-red-600
            dark:hover:bg-red-950 dark:hover:text-red-400
            transition-colors duration-150
          "
          title={collapsed ? t('nav.logout') : undefined}
        >
          <LogOut size={18} className="shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {t('nav.logout')}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Versão (centralizada no expandido, oculta quando colapsado) */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-center pt-1"
            >
              <VersionBadge />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Botão colapsar ── */}
      <button
        onClick={toggleCollapse}
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        className="
          absolute -right-3 top-[72px]
          w-6 h-6 rounded-full
          bg-[var(--color-surface)] border border-[var(--color-border)]
          flex items-center justify-center
          text-[var(--color-text-secondary)]
          hover:text-[var(--color-primary)]
          shadow-sm transition-colors duration-150 z-10
        "
      >
        {collapsed
          ? <ChevronRight size={12} />
          : <ChevronLeft  size={12} />
        }
      </button>
    </motion.aside>
  )
}
