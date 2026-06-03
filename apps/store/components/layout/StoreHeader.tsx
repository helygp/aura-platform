'use client'

/**
 * components/layout/StoreHeader.tsx
 * Header da loja B2B — logo do tenant, nav, badge do carrinho.
 * Ouve o evento 'cart-updated' para atualizar o badge sem prop drilling.
 */

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useTenant } from '@/components/layout/TenantProvider'
import { readCart, cartCount, CART_UPDATED_EVENT } from '@/lib/cart'
import { useAuth } from '@/lib/useAuth'

export default function StoreHeader() {
  const { theme } = useTenant()
  const { buyer, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [count, setCount] = useState(0)

  // Lê carrinho do localStorage após hidratação + ouve atualizações
  useEffect(() => {
    function sync() { setCount(cartCount(readCart())) }
    sync()
    window.addEventListener(CART_UPDATED_EVENT, sync)
    return () => window.removeEventListener(CART_UPDATED_EVENT, sync)
  }, [])

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">

        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          {theme.logoUrl ? (
            <img src={theme.logoUrl} alt={theme.name} className="h-8 w-auto object-contain" />
          ) : (
            <span className="text-lg font-bold tracking-tight text-foreground">{theme.name}</span>
          )}
        </Link>

        {/* Nav desktop */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/catalogo" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Catálogo
          </Link>
        </nav>

        {/* Ações */}
        <div className="flex items-center gap-2">

          {/* Carrinho com badge */}
          <Link
            href="/carrinho"
            className="relative flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-muted"
            aria-label={`Carrinho${count > 0 ? ` (${count} itens)` : ''}`}
          >
            <CartIcon />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </Link>

          {/* Conta */}
          {buyer ? (
            <div className="hidden items-center gap-2 md:flex">
              <span className="text-sm font-medium text-foreground">{buyer.name.split(' ')[0]}</span>
              <button onClick={() => logout()} className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted">Sair</button>
            </div>
          ) : (
            <Link href="/conta/login" className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-muted md:flex">
              <PersonIcon />
              Entrar
            </Link>
          )}

          {/* Hambúrguer mobile */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-muted md:hidden"
            aria-label="Menu"
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Drawer mobile */}
      {menuOpen && (
        <div className="border-t border-border bg-card px-4 pb-4 md:hidden">
          <nav className="flex flex-col gap-1 pt-3">
            {[
              { href: '/catalogo', label: 'Catálogo' },
              { href: '/carrinho', label: `Carrinho${count > 0 ? ` (${count})` : ''}` },
              { href: '/conta/login', label: 'Minha conta' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-muted"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}

// ─── Ícones ───────────────────────────────────────────────────────────────────

function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <line x1="3" x2="21" y1="6" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}
function PersonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}
function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}
