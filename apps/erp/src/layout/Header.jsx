/**
 * layout/Header.jsx
 *
 * Header topo — visível em todas as telas.
 *
 * Mobile (< md):
 *   [Logo/Nome do tenant]  ——  [Avatar dropdown]
 *   Toggles dark/lang ficam dentro do dropdown
 *
 * Desktop (md+):
 *   [Breadcrumb/Título da página]  ——  [Lang] [Dark] [Avatar dropdown]
 *
 * Props:
 *   tenantInfo : { name, logoUrl }
 *   pageTitle  : string (opcional, para breadcrumb)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sun, Moon, LogOut, User, ChevronDown } from 'lucide-react'
import { useTheme }    from '@aura/theme'
import { useLanguage } from '@aura/i18n'
import { useAuth }     from '../auth/AuthContext.jsx'

export function Header({ tenantInfo, pageTitle }) {
  const { t }                   = useTranslation()
  const { isDark, toggleDark }  = useTheme()
  const { language, toggleLanguage } = useLanguage()
  const { user, logout }        = useAuth()
  const navigate                = useNavigate()
  const [dropOpen, setDropOpen] = useState(false)
  const dropRef                 = useRef(null)

  /* Fecha dropdown ao clicar fora */
  useEffect(() => {
    function handleClick(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLogout = useCallback(async () => {
    setDropOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }, [logout, navigate])

  const userInitial = (user?.name ?? user?.email ?? 'U').charAt(0).toUpperCase()

  return (
    <header className="
      sticky top-0 z-20
      h-16 px-4 md:px-6
      flex items-center justify-between gap-4
      bg-[var(--color-surface)] border-b border-[var(--color-border)]
      shrink-0
    ">

      {/* ── Esquerda ── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Logo/nome visível apenas no mobile (sidebar escondida) */}
        <div className="flex items-center gap-2 md:hidden min-w-0">
          {tenantInfo?.logoUrl ? (
            <img
              src={tenantInfo.logoUrl}
              alt={tenantInfo.name}
              className="w-7 h-7 rounded object-contain shrink-0"
            />
          ) : (
            <div className="
              w-7 h-7 rounded flex items-center justify-center shrink-0
              bg-[var(--color-primary)] text-white text-xs font-bold
            ">
              {(tenantInfo?.name ?? 'A').charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
            {tenantInfo?.name ?? 'Aura'}
          </span>
        </div>

        {/* Título da página — desktop */}
        {pageTitle && (
          <h1 className="hidden md:block text-base font-semibold text-[var(--color-text-primary)] truncate">
            {pageTitle}
          </h1>
        )}
      </div>

      {/* ── Direita ── */}
      <div className="flex items-center gap-1 shrink-0">

        {/* Toggle idioma — desktop */}
        <button
          onClick={toggleLanguage}
          aria-label={`Idioma: ${language.toUpperCase()}`}
          className="
            hidden md:flex items-center gap-1.5
            h-9 px-3 rounded-lg
            text-xs font-semibold text-[var(--color-text-secondary)]
            hover:bg-[var(--color-surface-hover)]
            transition-colors duration-150
          "
        >
          {language.toUpperCase()}
        </button>

        {/* Toggle dark/light — desktop */}
        <button
          onClick={toggleDark}
          aria-label={isDark ? t('common.lightMode') : t('common.darkMode')}
          className="
            hidden md:flex items-center justify-center
            w-9 h-9 rounded-lg
            text-[var(--color-text-secondary)]
            hover:bg-[var(--color-surface-hover)]
            transition-colors duration-150
          "
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Avatar + dropdown ── */}
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setDropOpen(prev => !prev)}
            aria-label="Menu do usuário"
            aria-expanded={dropOpen}
            className="
              flex items-center gap-2 h-9 pl-1 pr-2 rounded-lg
              hover:bg-[var(--color-surface-hover)]
              transition-colors duration-150
            "
          >
            {/* Avatar */}
            <div className="
              w-7 h-7 rounded-full flex items-center justify-center
              bg-[var(--color-primary-muted)] text-[var(--color-primary)]
              text-xs font-bold shrink-0
            ">
              {userInitial}
            </div>
            <span className="hidden md:block text-sm font-medium text-[var(--color-text-primary)] max-w-[120px] truncate">
              {user?.name ?? user?.email}
            </span>
            <ChevronDown
              size={14}
              className={`hidden md:block text-[var(--color-text-tertiary)] transition-transform duration-150 ${dropOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown */}
          {dropOpen && (
            <div className="
              absolute right-0 top-full mt-1
              w-52 rounded-xl overflow-hidden
              bg-[var(--color-surface)] border border-[var(--color-border)]
              shadow-lg shadow-black/10
              py-1 z-50
            ">
              {/* Info usuário */}
              <div className="px-4 py-2.5 border-b border-[var(--color-border)]">
                <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                  {user?.name ?? user?.email}
                </p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] capitalize">
                  {user?.role}
                </p>
              </div>

              {/* Toggles — sempre visíveis no dropdown (inclui mobile) */}
              <div className="px-4 py-2 space-y-1">
                {/* Dark/light */}
                <button
                  onClick={() => { toggleDark(); setDropOpen(false) }}
                  className="
                    w-full flex items-center gap-3 py-2 text-sm
                    text-[var(--color-text-secondary)]
                    hover:text-[var(--color-text-primary)]
                    transition-colors duration-150
                  "
                >
                  {isDark ? <Sun size={16} /> : <Moon size={16} />}
                  <span>{isDark ? t('common.lightMode') : t('common.darkMode')}</span>
                </button>

                {/* Idioma */}
                <button
                  onClick={() => { toggleLanguage(); setDropOpen(false) }}
                  className="
                    w-full flex items-center gap-3 py-2 text-sm
                    text-[var(--color-text-secondary)]
                    hover:text-[var(--color-text-primary)]
                    transition-colors duration-150
                  "
                >
                  <span className="text-base">🌐</span>
                  <span>
                    {language === 'pt' ? 'Switch to English' : 'Mudar para Português'}
                  </span>
                </button>
              </div>

              <div className="border-t border-[var(--color-border)] pt-1">
                {/* Perfil */}
                <button
                  onClick={() => { navigate('/profile'); setDropOpen(false) }}
                  className="
                    w-full flex items-center gap-3 px-4 py-2.5 text-sm
                    text-[var(--color-text-secondary)]
                    hover:bg-[var(--color-surface-hover)]
                    hover:text-[var(--color-text-primary)]
                    transition-colors duration-150
                  "
                >
                  <User size={15} />
                  {t('nav.profile')}
                </button>

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="
                    w-full flex items-center gap-3 px-4 py-2.5 text-sm
                    text-red-500 hover:bg-red-50 dark:hover:bg-red-950
                    transition-colors duration-150
                  "
                >
                  <LogOut size={15} />
                  {t('nav.logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
