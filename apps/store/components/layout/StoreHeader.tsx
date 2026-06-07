'use client'

/**
 * components/layout/StoreHeader.tsx
 * Header moderno: logo, busca integrada no desktop, carrinho, conta.
 */

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useTenant } from '@/components/layout/TenantProvider'
import { readCart, cartCount, CART_UPDATED_EVENT } from '@/lib/cart'
import { useAuth } from '@/lib/useAuth'

export default function StoreHeader() {
  const { theme }         = useTenant()
  const { buyer, logout } = useAuth()
  const router            = useRouter()
  const pathname          = usePathname()

  const [menuOpen,   setMenuOpen]   = useState(false)
  const [acctOpen,   setAcctOpen]   = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query,      setQuery]      = useState('')
  const [count,      setCount]      = useState(0)

  const searchRef = useRef<HTMLInputElement>(null)
  const acctRef   = useRef<HTMLDivElement>(null)

  // Badge do carrinho
  useEffect(() => {
    function sync() { setCount(cartCount(readCart())) }
    sync()
    window.addEventListener(CART_UPDATED_EVENT, sync)
    return () => window.removeEventListener(CART_UPDATED_EVENT, sync)
  }, [])

  // Fechar dropdown conta ao clicar fora
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (acctRef.current && !acctRef.current.contains(e.target as Node)) {
        setAcctOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Fechar menu mobile ao mudar de rota
  useEffect(() => { setMenuOpen(false); setAcctOpen(false) }, [pathname])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/catalogo?search=${encodeURIComponent(query.trim())}`)
      setQuery('')
      setSearchOpen(false)
    }
  }

  const isActive = (href: string) => pathname?.startsWith(href)

  // Iniciais do buyer para avatar
  const initials = buyer
    ? buyer.name.trim().split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
    : ''

  return (
    <>
      {/* ── Barra de anúncio B2B ── */}
      <div className="hidden md:flex items-center justify-center gap-6 border-b border-border bg-muted/50 px-4 py-1.5 text-[11px] font-medium text-muted-foreground">
        <span>⚡ Atacado exclusivo para lojistas</span>
        <span className="text-border">|</span>
        <span>Pedido mínimo por grade · Desconto por volume</span>
        <span className="text-border">|</span>
        <span>Envio para todo o Brasil</span>
      </div>

      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">

          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            {theme.logoUrl ? (
              <img src={theme.logoUrl} alt={theme.name} className="h-8 w-auto object-contain" />
            ) : (
              <span className="text-base font-extrabold tracking-tight text-foreground">
                {theme.name}
              </span>
            )}
          </Link>

          {/* Busca — desktop integrada */}
          <form
            onSubmit={handleSearch}
            className="mx-4 hidden flex-1 md:flex"
          >
            <div className="relative w-full max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar produtos…"
                className="h-9 w-full rounded-full border border-border bg-muted/60 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
          </form>

          {/* Nav desktop */}
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            <NavLink href="/catalogo" active={isActive('/catalogo')}>
              Catálogo
            </NavLink>
            {buyer && (
              <NavLink href="/conta/pedidos" active={isActive('/conta/pedidos')}>
                Meus pedidos
              </NavLink>
            )}
          </nav>

          {/* Ações direita */}
          <div className="ml-auto flex items-center gap-1 md:ml-0">

            {/* Busca mobile */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground md:hidden"
              aria-label="Buscar"
            >
              <SearchIcon />
            </button>

            {/* Carrinho */}
            <Link
              href="/carrinho"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label={`Carrinho${count > 0 ? ` (${count} itens)` : ''}`}
            >
              <CartIcon />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground ring-2 ring-card">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </Link>

            {/* Conta — logado: avatar com dropdown | deslogado: botão entrar */}
            {buyer ? (
              <div ref={acctRef} className="relative hidden md:block">
                <button
                  onClick={() => setAcctOpen(!acctOpen)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold text-primary-foreground transition ring-2 ring-primary/20 hover:ring-primary/40"
                  style={{ background: 'var(--color-primary)' }}
                  aria-label="Minha conta"
                >
                  {initials}
                </button>

                {acctOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-lg shadow-black/10">
                    <div className="border-b border-border px-4 py-3">
                      <p className="text-sm font-semibold text-foreground truncate">{buyer.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{buyer.email}</p>
                    </div>
                    <div className="p-1">
                      <DropdownLink href="/conta/pedidos" onClick={() => setAcctOpen(false)}>
                        Meus pedidos
                      </DropdownLink>
                      {buyer.creditLimit > 0 && (
                        <div className="px-3 py-1.5">
                          <p className="text-[10px] text-muted-foreground">Crédito disponível</p>
                          <p className="text-sm font-bold text-primary">{formatPrice(buyer.creditAvailable)}</p>
                        </div>
                      )}
                      <button
                        onClick={() => { logout(); setAcctOpen(false) }}
                        className="flex w-full items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        <LogoutIcon />
                        Sair
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/conta/login"
                className="hidden items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted md:flex"
              >
                <PersonIcon />
                Entrar
              </Link>
            )}

            {/* Hambúrguer mobile */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted md:hidden"
              aria-label="Menu"
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {/* Busca mobile expandida */}
        {searchOpen && (
          <div className="border-t border-border bg-card px-4 pb-3 pt-2 md:hidden">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar produtos…"
                  className="h-10 w-full rounded-full border border-border bg-muted pl-9 pr-4 text-sm focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </form>
          </div>
        )}

        {/* Drawer mobile */}
        {menuOpen && (
          <div className="border-t border-border bg-card px-4 pb-4 md:hidden">
            <nav className="flex flex-col gap-0.5 pt-3">
              {[
                { href: '/catalogo',       label: 'Catálogo' },
                { href: '/carrinho',       label: `Carrinho${count > 0 ? ` (${count})` : ''}` },
                buyer
                  ? { href: '/conta/pedidos', label: 'Meus pedidos' }
                  : { href: '/conta/login',   label: 'Entrar' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={[
                    'rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium transition',
                    isActive(href) ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                  ].join(' ')}
                >
                  {label}
                </Link>
              ))}
              {buyer && (
                <button
                  onClick={() => { logout(); setMenuOpen(false) }}
                  className="mt-1 rounded-[var(--radius)] px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition hover:bg-muted"
                >
                  Sair da conta
                </button>
              )}
            </nav>
          </div>
        )}
      </header>
    </>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={[
        'rounded-full px-3.5 py-1.5 text-sm font-medium transition',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      ].join(' ')}
    >
      {children}
    </Link>
  )
}

function DropdownLink({ href, onClick, children }: { href: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center rounded-[var(--radius)] px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
    >
      {children}
    </Link>
  )
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

// ─── Ícones ───────────────────────────────────────────────────────────────────

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  )
}
function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
      <line x1="3" x2="21" y1="6" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  )
}
function PersonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  )
}
function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
    </svg>
  )
}
function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12"/>
    </svg>
  )
}
