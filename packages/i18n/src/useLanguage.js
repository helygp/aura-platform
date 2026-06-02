/**
 * useLanguage.js — Aura i18n
 *
 * Hook para controle de idioma em componentes React.
 *
 * const { language, setLanguage, toggleLanguage, isPT, isEN } = useLanguage()
 *
 * setLanguage('en')   → muda para inglês e persiste
 * toggleLanguage()    → alterna PT ↔ EN
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { STORAGE_KEY, SUPPORTED_LANGUAGES } from './i18n.js'

export function useLanguage() {
  const { i18n } = useTranslation()
  const language  = i18n.language?.split('-')[0] ?? 'pt'

  const setLanguage = useCallback((lang) => {
    if (!SUPPORTED_LANGUAGES.includes(lang)) return
    i18n.changeLanguage(lang)
    try { localStorage.setItem(STORAGE_KEY, lang) } catch {}
  }, [i18n])

  const toggleLanguage = useCallback(() => {
    const next = language === 'pt' ? 'en' : 'pt'
    setLanguage(next)
  }, [language, setLanguage])

  return {
    language,
    setLanguage,
    toggleLanguage,
    isPT: language === 'pt',
    isEN: language === 'en',
    supportedLanguages: SUPPORTED_LANGUAGES,
  }
}
