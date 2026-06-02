/**
 * hooks/useAnalytics.js
 *
 * Injeta GA4 no ERP quando o tenant tem ga4MeasurementId configurado.
 * Chamado uma vez no AppLayout após o tenant info estar disponível.
 *
 * Segurança:
 *   - Valida formato do ID (G-XXXXXXXXXX) antes de injetar
 *   - Não injeta mais de uma vez (idempotente via window.gtag check)
 *   - Remove scripts antigos se o ID mudar (troca de tenant)
 */

import { useEffect } from 'react'

const GA4_SCRIPT_ID = 'aura-ga4-script'
const GA4_INIT_ID   = 'aura-ga4-init'

/**
 * Injeta GA4 no ERP.
 * @param {string|null} measurementId  ex: "G-ABC1234567"
 */
export function useAnalytics(measurementId) {
  useEffect(() => {
    // Limpar scripts anteriores (útil se o ID mudar)
    removeScript(GA4_SCRIPT_ID)
    removeScript(GA4_INIT_ID)

    if (!measurementId || !/^G-[A-Z0-9]+$/i.test(measurementId)) return

    // Evitar reinjeção se já inicializado com o mesmo ID
    if (window._auraGa4Id === measurementId) return

    // Script de carregamento
    const loaderScript = document.createElement('script')
    loaderScript.id    = GA4_SCRIPT_ID
    loaderScript.async = true
    loaderScript.src   = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
    document.head.appendChild(loaderScript)

    // Script de inicialização
    const initScript = document.createElement('script')
    initScript.id = GA4_INIT_ID
    initScript.textContent = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}', {
  anonymize_ip: true,
  cookie_flags: 'SameSite=None;Secure',
  send_page_view: false
});`
    document.head.appendChild(initScript)

    window._auraGa4Id = measurementId

    // Cleanup ao desmontar (ex: logout)
    return () => {
      removeScript(GA4_SCRIPT_ID)
      removeScript(GA4_INIT_ID)
      delete window._auraGa4Id
    }
  }, [measurementId])
}

/**
 * Rastreia navegação de página no ERP (chamado no React Router).
 * Chame após cada mudança de rota.
 * @param {string} path
 * @param {string} title
 */
export function trackPageView(path, title) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_path:  path,
      page_title: title,
    })
  }
}

function removeScript(id) {
  const el = document.getElementById(id)
  if (el) el.remove()
}
