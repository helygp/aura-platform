'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { href: '#features',   label: 'Funcionalidades' },
    { href: '#pricing',    label: 'Preços' },
    { href: '#comparativo',label: 'Comparativo' },
    { href: '#faq',        label: 'FAQ' },
  ]

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-[var(--color-bg)]/95 backdrop-blur border-b border-[var(--color-border)]' : ''
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-md gradient-brand flex items-center justify-center shadow-lg animate-pulse-glow">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <span className="font-heading font-bold text-lg text-[var(--color-text)]">
            Aura<span className="text-[var(--color-primary)]"> Platform</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a key={l.href} href={l.href}
               className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              {l.label}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <a href="https://acme.aurabr.app" target="_blank" rel="noopener noreferrer"
             className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
            Entrar
          </a>
          <a href="/cadastro"
             className="gradient-cta text-white text-sm font-semibold px-4 py-2 rounded-md hover:opacity-90 transition-opacity">
            Começar grátis
          </a>
        </div>

        {/* Mobile menu btn */}
        <button onClick={() => setMenuOpen(!menuOpen)}
                className="md:hidden p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          {menuOpen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)] px-4 pb-4 pt-2 flex flex-col gap-3">
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
               className="text-sm py-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              {l.label}
            </a>
          ))}
          <a href="/cadastro"
             className="gradient-cta text-white text-sm font-semibold px-4 py-3 rounded-md text-center mt-2">
            Começar grátis — 14 dias
          </a>
        </div>
      )}
    </header>
  )
}
