// @aura/i18n — barrel export

// Instância configurada (importar no entry-point do app para garantir init)
export { default as i18n } from './i18n.js'

// Re-export direto do react-i18next — não precisa de wrapper
export { useTranslation, Trans, I18nextProvider } from 'react-i18next'

// Hook de controle de idioma
export { useLanguage } from './useLanguage.js'

// Constantes
export {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  STORAGE_KEY as I18N_STORAGE_KEY,
} from './i18n.js'
