/**
 * lib/parseUA.js
 * Parse de User-Agent usando ua-parser-js.
 * Retorna objeto normalizado com os campos que interessam pro master panel.
 */
import { UAParser } from 'ua-parser-js'

/**
 * @param {string|null} ua
 * @returns {{ os: string|null, browser: string|null, device: string, vendor: string|null, model: string|null, raw: string|null }}
 */
export function parseUA(ua) {
  if (!ua) return { os: null, browser: null, device: 'unknown', vendor: null, model: null, raw: null }

  const r = UAParser(ua)

  const os      = r.os?.name     ? `${r.os.name}${r.os.version ? ' ' + r.os.version : ''}` : null
  const browser = r.browser?.name ? `${r.browser.name}${r.browser.major ? ' ' + r.browser.major : ''}` : null
  const vendor  = r.device?.vendor ?? null
  const model   = r.device?.model  ?? null

  // tipo normalizado: mobile | tablet | desktop | bot | unknown
  const type = r.device?.type ?? 'desktop'

  return { os, browser, device: type, vendor, model, raw: ua.slice(0, 200) }
}
