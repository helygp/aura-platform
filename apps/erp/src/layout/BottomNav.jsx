/**
 * layout/BottomNav.jsx
 *
 * Navegação inferior mobile — visível apenas em telas < md.
 * Exibe os 5 itens principais do BOTTOM_NAV_ITEMS.
 * Item ativo destacado com cor primária.
 */

import React from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, Package, Warehouse, ShoppingCart,
  Users, MessageCircle, Settings, CreditCard, BarChart2,
} from 'lucide-react'
import { BOTTOM_NAV_ITEMS } from './navItems.js'
import { useAuth } from '../auth/AuthContext.jsx'

const ICONS = {
  LayoutDashboard, Package, Warehouse, ShoppingCart,
  Users, MessageCircle, Settings, CreditCard, BarChart2,
}

export function BottomNav() {
  const { t }    = useTranslation()
  const { user, hasRole } = useAuth()

  const visibleItems = BOTTOM_NAV_ITEMS.filter(item =>
    item.roles === null || (user && hasRole(...item.roles))
  )

  return (
    <nav className="
      md:hidden fixed bottom-0 left-0 right-0 z-40
      bg-[var(--color-surface)] border-t border-[var(--color-border)]
      flex items-stretch
      safe-area-pb
    ">
      {visibleItems.map(item => {
        const Icon = ICONS[item.icon]
        return (
          <NavLink
            key={item.key}
            to={item.path}
            className={({ isActive }) => `
              flex-1 flex flex-col items-center justify-center
              gap-0.5 py-2 px-1 min-w-0
              text-[10px] font-medium transition-colors duration-150
              ${isActive
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-text-tertiary)]'
              }
            `}
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 1.75}
                  className={isActive ? 'text-[var(--color-primary)]' : ''}
                />
                <span className="truncate w-full text-center leading-tight">
                  {t(`nav.${item.key}`)}
                </span>
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}
