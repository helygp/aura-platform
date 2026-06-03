/**
 * i18n.js — Aura i18n
 *
 * Instância configurada do i18next.
 * - Detector de idioma do browser (navigator.language)
 * - Toggle persistido em localStorage (chave: 'aura-lang')
 * - Fallback para 'pt' quando idioma não suportado
 * - Interpolação com {{variável}}
 */

import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import pt from './locales/pt.json'
import en from './locales/en.json'

export const SUPPORTED_LANGUAGES = ['pt', 'en']
export const DEFAULT_LANGUAGE     = 'pt'
export const STORAGE_KEY          = 'aura-lang'

/* ─── Detectar idioma inicial ─── */
function detectLanguage() {
  // 1. Preferência salva pelo usuário
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored
  } catch {}

  // 2. Idioma do browser (ex: 'pt-BR' → 'pt', 'en-US' → 'en')
  if (typeof navigator !== 'undefined') {
    const langs = navigator.languages?.length
      ? navigator.languages
      : [navigator.language]

    for (const lang of langs) {
      const code = lang.split('-')[0].toLowerCase()
      if (SUPPORTED_LANGUAGES.includes(code)) return code
    }
  }

  // 3. Fallback
  return DEFAULT_LANGUAGE
}

/* ─── Init ─── */
i18next
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: pt },
      en: { translation: en },
    },
    lng:          detectLanguage(),
    fallbackLng:  DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,

    interpolation: {
      escapeValue: false, // React já escapa
    },

    // Não logar warnings em produção
    debug: false,

    // Retorna a chave se tradução não existir (evita undefined na UI)
    returnNull: false,
    returnEmptyString: false,
  })

export default i18next
