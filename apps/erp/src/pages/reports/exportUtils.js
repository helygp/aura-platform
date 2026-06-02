/**
 * exportUtils.js — CSV e PDF para os relatórios
 * PDF via jsPDF + jspdf-autotable (instalados separadamente)
 * CSS: usa variáveis de tema mas o PDF tem paleta fixa profissional
 */

/* ── CSV ── */
export function exportCSV(filename, columns, rows) {
  const header = columns.map(c => `"${c.label}"`).join(';')
  const body   = rows.map(r =>
    columns.map(c => {
      const v = c.get ? c.get(r) : (r[c.key] ?? '')
      return `"${String(v).replace(/"/g, '""')}"`
    }).join(';')
  ).join('\n')
  const bom  = '\uFEFF'
  const blob = new Blob([bom + header + '\n' + body], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename + '.csv' })
  a.click()
  URL.revokeObjectURL(url)
}

/* ── PDF ── */
const BRAND = {
  primary:  [2, 132, 199],   // azul
  dark:     [15, 23, 42],    // quase preto
  muted:    [100, 116, 139], // cinza
  white:    [255, 255, 255],
  light:    [241, 245, 249],
  success:  [16, 185, 129],
  warning:  [245, 158, 11],
  danger:   [239, 68, 68],
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR')
}

export async function exportPDF({ title, subtitle, companyName, columns, rows, summary }) {
  const { jsPDF }      = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc  = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W    = doc.internal.pageSize.getWidth()
  const now  = new Date().toLocaleString('pt-BR')

  /* ── Cabeçalho ── */
  // Barra primária
  doc.setFillColor(...BRAND.primary)
  doc.rect(0, 0, W, 22, 'F')

  // Nome da empresa
  doc.setTextColor(...BRAND.white)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(companyName || 'Aura Platform', 12, 10)

  // Título do relatório
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(title, 12, 16)

  // Data de geração (direita)
  doc.setFontSize(8)
  doc.text(`Gerado em: ${now}`, W - 12, 16, { align: 'right' })

  // Subtítulo / período (abaixo da barra)
  if (subtitle) {
    doc.setTextColor(...BRAND.muted)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.text(subtitle, 12, 28)
  }

  /* ── Cards de resumo ── */
  let yAfterSummary = subtitle ? 32 : 26
  if (summary?.length) {
    const cardW = (W - 24 - (summary.length - 1) * 4) / summary.length
    summary.forEach((s, i) => {
      const x = 12 + i * (cardW + 4)
      doc.setFillColor(...BRAND.light)
      doc.roundedRect(x, yAfterSummary, cardW, 18, 2, 2, 'F')
      doc.setTextColor(...BRAND.primary)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text(String(s.value), x + cardW / 2, yAfterSummary + 9, { align: 'center' })
      doc.setTextColor(...BRAND.muted)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(s.label, x + cardW / 2, yAfterSummary + 14, { align: 'center' })
    })
    yAfterSummary += 24
  }

  /* ── Tabela ── */
  autoTable(doc, {
    startY:     yAfterSummary + 2,
    head:       [columns.map(c => c.label)],
    body:       rows.map(r => columns.map(c => c.get ? c.get(r) : (r[c.key] ?? ''))),
    theme:      'striped',
    headStyles: {
      fillColor:  BRAND.primary,
      textColor:  BRAND.white,
      fontStyle:  'bold',
      fontSize:   8,
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize:    8,
      cellPadding: 2.5,
      textColor:   BRAND.dark,
    },
    alternateRowStyles: { fillColor: BRAND.light },
    columnStyles: columns.reduce((acc, c, i) => {
      if (c.align) acc[i] = { halign: c.align }
      if (c.width) acc[i] = { ...(acc[i] || {}), cellWidth: c.width }
      return acc
    }, {}),
    margin:     { left: 12, right: 12 },
    didDrawPage: (data) => {
      // Rodapé em cada página
      const pageH = doc.internal.pageSize.getHeight()
      doc.setFillColor(...BRAND.primary)
      doc.rect(0, pageH - 8, W, 8, 'F')
      doc.setTextColor(...BRAND.white)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(companyName || 'Aura Platform', 12, pageH - 2.5)
      doc.text(
        `Página ${data.pageNumber}`,
        W - 12, pageH - 2.5, { align: 'right' }
      )
    },
  })

  doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}.pdf`)
}

export { fmtDate }
