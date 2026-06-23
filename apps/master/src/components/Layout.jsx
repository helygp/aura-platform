/**
 * Layout principal do painel master.
 * Sidebar fixa (desktop) + topbar (mobile).
 */
import React, { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, CreditCard, Settings,
  Menu, X, ChevronRight, LogOut, Zap, Database,
} from 'lucide-react'

const NAV = [
  { to: '/',        icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/tenants', icon: Users,           label: 'Tenants'    },
  { to: '/backups', icon: Database,        label: 'Backups'    },
  { to: '/billing', icon: CreditCard,      label: 'Billing'    },
]

function NavItem({ to, icon: Icon, label, onClick }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
         ${isActive
           ? 'bg-[var(--color-primary)] text-white'
           : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'
         }`
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  )
}

export function Layout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[var(--color-bg-subtle)] flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-60 border-r border-[var(--color-border)] bg-[var(--color-bg)] p-4 gap-1 fixed h-full z-20">
        <div className="flex items-center gap-2 px-3 py-3 mb-4">
          <div className="w-7 h-7 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="font-bold text-[var(--color-text)] text-sm tracking-tight">
            Aura <span className="text-[var(--color-primary)]">Master</span>
          </span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {NAV.map(n => <NavItem key={n.to} {...n} />)}
        </nav>

        <div className="border-t border-[var(--color-border)] pt-3 mt-3">
          <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
            Painel restrito — acesso privado
          </div>
        </div>
      </aside>

      {/* Topbar mobile */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-[var(--color-bg)] border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[var(--color-primary)] flex items-center justify-center">
            <Zap size={12} className="text-white" />
          </div>
          <span className="font-bold text-sm text-[var(--color-text)]">Aura Master</span>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-muted)]"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Drawer mobile */}
      {open && (
        <div className="md:hidden fixed inset-0 z-20 bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="absolute left-0 top-0 bottom-0 w-60 bg-[var(--color-bg)] p-4 flex flex-col gap-1"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-3 py-3 mb-4 mt-10">
              <span className="font-bold text-[var(--color-text)]">Aura Master</span>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV.map(n => <NavItem key={n.to} {...n} onClick={() => setOpen(false)} />)}
            </nav>
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <main className="flex-1 md:ml-60 pt-14 md:pt-0 min-h-screen">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
