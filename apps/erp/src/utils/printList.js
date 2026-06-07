/**
 * utils/printList.js
 * T4.1 — Abre nova aba com lista formatada para impressão/PDF.
 *
 * Uso:
 *   import { printList } from '../../utils/printList.js'
 *   printList({ title, columns, rows, summary, subtitle })
 *
 * columns: [{ label, key?, get?: fn(row,i), align?: 'right'|'left' }]
 * rows:    array de objetos
 * summary: [{ label, value }]  — opcional, linha de totais
 */

export function printList({ title = 'Lista', columns = [], rows = [], summary = [], subtitle = '' }) {
  const now = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())

  const headerRow = columns.map(c =>
    `<th style="text-align:${c.align === 'right' ? 'right' : 'left'}">${c.label}</th>`
  ).join('')

  const bodyRows = rows.map((row, i) => {
    const cells = columns.map(c => {
      const raw = c.get ? c.get(row, i) : (row[c.key] ?? '—')
      const val = raw == null ? '—' : raw
      return `<td style="text-align:${c.align === 'right' ? 'right' : 'left'}">${val}</td>`
    }).join('')
    return `<tr class="${i % 2 === 0 ? '' : 'alt'}">${cells}</tr>`
  }).join('') || `<tr><td colspan="${columns.length}" style="text-align:center;color:#aaa;padding:20px">Nenhum registro.</td></tr>`

  const summaryHtml = summary.length
    ? `<div class="summary">${summary.map(s => `<span><em>${s.label}:</em> <strong>${s.value}</strong></span>`).join('')}</div>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/><title>${title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#111;padding:28px}
.hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px}
.hd h1{font-size:18px;font-weight:700}.hd .sub{font-size:11px;color:#777;margin-top:3px}
.hd .ts{font-size:11px;color:#888}
.summary{display:flex;flex-wrap:wrap;gap:16px;padding:9px 14px;background:#f5f5f5;border-radius:6px;font-size:12px;margin-bottom:12px}
.summary em{color:#666;font-style:normal}
table{width:100%;border-collapse:collapse}
th{background:#efefef;padding:6px 10px;font-size:11px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #ddd}
td{padding:6px 10px;border-bottom:1px solid #f0f0f0;vertical-align:top;font-size:12px}
tr.alt td{background:#f9f9f9}
.footer{margin-top:10px;font-size:11px;color:#999;text-align:right}
.print-btn{position:fixed;top:12px;right:12px;padding:8px 18px;background:#0070f3;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;box-shadow:0 2px 8px rgba(0,112,243,.3)}
@media print{.print-btn{display:none}@page{margin:1.5cm;size:A4}}
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨 Imprimir / PDF</button>
<div class="hd">
  <div><h1>${title}</h1>${subtitle ? `<div class="sub">${subtitle}</div>` : ''}</div>
  <div class="ts">Gerado em ${now}</div>
</div>
${summaryHtml}
<table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>
<div class="footer">${rows.length} registro${rows.length !== 1 ? 's' : ''}</div>
</body></html>`

  const win = window.open('', '_blank')
  if (!win) { alert('Permita pop-ups para imprimir.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
}
