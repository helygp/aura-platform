/**
 * ImportModal.jsx — Importação de produtos via Excel ou CSV
 *
 * Fluxo:
 *  1. Usuário arrasta ou seleciona arquivo
 *  2. Preview das primeiras linhas + validação de colunas
 *  3. Clica em "Importar" → envia para API
 *  4. Resultado linha a linha
 */

import React, { useState, useRef, useCallback } from 'react'
import {
  Upload, X, FileSpreadsheet, CheckCircle,
  AlertTriangle, Download, Loader2, Info
} from 'lucide-react'
import * as XLSX from 'xlsx'

/* ─── Template ───────────────────────────────────────────────── */
const TEMPLATE_COLS = [
  'nome', 'codigo', 'categoria', 'tipo',
  'preco', 'estoque', 'estoque_minimo',
  'variacao_1_nome', 'variacao_1_valor',
  'variacao_2_nome', 'variacao_2_valor',
]

const TEMPLATE_ROWS = [
  ['Camiseta Básica', 'CAM-001', 'Camisetas', 'simples', '39.90', '100', '20', '', '', '', ''],
  ['Tênis Runner Pro', 'TEN-001-P-PT', 'Calçados', 'variante', '89.90', '30', '5', 'Tamanho', 'P', 'Cor', 'Preto'],
  ['Tênis Runner Pro', 'TEN-001-P-BR', 'Calçados', 'variante', '89.90', '25', '5', 'Tamanho', 'P', 'Cor', 'Branco'],
  ['Calça Jeans Slim', 'CAL-001', 'Calças', 'simples', '129.90', '50', '10', '', '', '', ''],
  ['Bolsa Couro Clássica', 'BOL-001-PT', 'Bolsas', 'variante', '249.90', '15', '3', 'Cor', 'Preto', '', ''],
  ['Bolsa Couro Clássica', 'BOL-001-MA', 'Bolsas', 'variante', '249.90', '12', '3', 'Cor', 'Marrom', '', ''],
]

const FIELD_DOCS = [
  { col: 'nome *',             desc: 'Nome do produto (obrigatório)' },
  { col: 'codigo *',           desc: 'Código único de referência (obrigatório)' },
  { col: 'categoria',          desc: 'Categoria. Ex: Camisetas, Calças' },
  { col: 'tipo',               desc: '"simples" ou "variante" (padrão: simples)' },
  { col: 'preco',              desc: 'Preço de atacado. Ex: 39.90' },
  { col: 'estoque',            desc: 'Quantidade inicial em estoque' },
  { col: 'estoque_minimo',     desc: 'Alerta quando estoque cair abaixo deste valor' },
  { col: 'variacao_1_nome',    desc: 'Nome do atributo. Ex: Tamanho' },
  { col: 'variacao_1_valor',   desc: 'Valor do atributo. Ex: P, M, G, GG' },
  { col: 'variacao_2_nome',    desc: 'Segundo atributo. Ex: Cor' },
  { col: 'variacao_2_valor',   desc: 'Valor do segundo atributo. Ex: Preto, Branco' },
]

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLS, ...TEMPLATE_ROWS])
  ws['!cols'] = TEMPLATE_COLS.map((_, i) => ({ wch: i < 2 ? 22 : i < 4 ? 12 : 18 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Produtos')
  XLSX.writeFile(wb, 'modelo-importacao-produtos.xlsx')
}

/* ─── Validação por linha ─────────────────────────────────────── */
function validateRows(rows) {
  if (!rows.length) return { valid: [], invalid: [{ linha: 1, erro: 'Planilha vazia.' }] }

  const headers = Object.keys(rows[0]).map(h => h.toLowerCase().trim())
  const hasNome   = headers.some(h => ['nome','name','produto'].includes(h))
  const hasCodigo = headers.some(h => ['codigo','código','code','sku','ref','referencia'].includes(h))

  if (!hasNome && !hasCodigo) {
    return {
      valid: [],
      invalid: [{ linha: 1, erro: 'Colunas "nome" e "codigo" não encontradas. Verifique o cabeçalho da planilha.' }],
      headerError: true
    }
  }

  const valid = [], invalid = []

  rows.forEach((row, i) => {
    const lineNum = i + 2
    const erros = []

    // Encontrar valores independente do nome exato da coluna
    const get = (...keys) => {
      for (const k of keys) {
        const found = Object.keys(row).find(h => h.toLowerCase().trim() === k)
        if (found !== undefined && row[found] !== undefined && row[found] !== '') {
          return row[found].toString().trim()
        }
      }
      return ''
    }

    const nome   = get('nome','name','produto','product')
    const codigo = get('codigo','código','code','sku','referencia','referência','ref')
    const preco  = get('preco','preço','price','preco_atacado','preço_atacado','valor')
    const estoque = get('estoque','stock','qty','quantidade')
    const min    = get('estoque_minimo','estoque_mínimo','stock_min','min_stock','minimo','mínimo')

    if (!nome) erros.push('Coluna "nome" vazia')
    if (!codigo && !nome) erros.push('Coluna "codigo" vazia')

    const precoNum = preco ? parseFloat(preco.replace(',','.')) : 0
    if (preco && isNaN(precoNum)) erros.push(`Preço inválido: "${preco}"`)
    if (precoNum < 0) erros.push('Preço não pode ser negativo')

    const estoqueNum = estoque ? parseInt(estoque) : 0
    if (estoque && isNaN(estoqueNum)) erros.push(`Estoque inválido: "${estoque}"`)

    const minNum = min ? parseInt(min) : 0
    if (min && isNaN(minNum)) erros.push(`Estoque mínimo inválido: "${min}"`)

    if (erros.length) {
      invalid.push({ linha: lineNum, nome: nome || '—', codigo, erros })
    } else {
      valid.push({ linha: lineNum, nome, codigo, row })
    }
  })

  return { valid, invalid, headers }
}

/* ─── Componente principal ────────────────────────────────────── */
export function ImportModal({ open, onClose, onSuccess }) {
  const [step,     setStep]     = useState('idle')
  const [file,     setFile]     = useState(null)
  const [rows,     setRows]     = useState([])
  const [validated, setValidated] = useState(null)  // { valid, invalid }
  const [result,   setResult]   = useState(null)
  const [errMsg,   setErrMsg]   = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [showDocs, setShowDocs] = useState(false)
  const [progress, setProgress] = useState(0)
  const inputRef = useRef()

  const reset = () => {
    setStep('idle'); setFile(null); setRows([])
    setValidated(null); setResult(null); setErrMsg('')
    setDragOver(false); setShowDocs(false); setProgress(0)
  }

  const handleClose = () => { reset(); onClose() }

  const parseFile = useCallback((f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['xlsx','xls','csv'].includes(ext)) {
      setErrMsg(`Formato não suportado: .${ext}. Use .xlsx, .xls ou .csv`)
      setStep('error')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setErrMsg('Arquivo muito grande. Máximo 10MB.')
      setStep('error')
      return
    }

    setFile(f)
    setStep('parsing')
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb  = XLSX.read(e.target.result, { type: 'binary', cellDates: true })
        const ws  = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })

        if (raw.length === 0) {
          setErrMsg('Planilha vazia ou primeira aba sem dados.')
          setStep('error')
          return
        }
        if (raw.length > 2000) {
          setErrMsg(`Máximo 2.000 linhas. Esta planilha tem ${raw.length}.`)
          setStep('error')
          return
        }

        setRows(raw)
        const v = validateRows(raw)
        setValidated(v)
        setStep(v.headerError ? 'error' : 'preview')
        if (v.headerError) setErrMsg(v.invalid[0]?.erro || 'Erro no cabeçalho.')

      } catch (err) {
        setErrMsg('Não foi possível ler o arquivo: ' + err.message)
        setStep('error')
      }
    }
    reader.onerror = () => { setErrMsg('Erro ao ler o arquivo.'); setStep('error') }
    reader.readAsBinaryString(f)
  }, [])

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) parseFile(f)
  }

  const handleImport = async () => {
    if (!validated?.valid?.length) return
    setStep('loading'); setProgress(0)

    // Simular progresso visual
    const timer = setInterval(() => {
      setProgress(p => Math.min(p + 8, 90))
    }, 200)

    try {
      const token = window.__aura_mem_token__ || ''
      const res = await fetch('/api/products/import', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
        },
        body: JSON.stringify({ rows }),
      })
      clearInterval(timer)
      setProgress(100)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro na importação')
      setResult(data)
      setStep('done')
      if (data.inserted + data.updated > 0) onSuccess?.(data)
    } catch (err) {
      clearInterval(timer)
      setErrMsg(err.message)
      setStep('error')
    }
  }

  if (!open) return null

  const hasErrors = validated?.invalid?.length > 0
  const canImport = validated?.valid?.length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="w-full sm:max-w-2xl bg-[var(--color-bg)] sm:rounded-2xl shadow-2xl flex flex-col max-h-[96dvh]">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-border)] shrink-0">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
            <FileSpreadsheet size={20} className="text-[var(--color-primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-[var(--color-text)]">Importar Produtos</h2>
            <p className="text-xs text-[var(--color-text-muted)] truncate">
              Excel (.xlsx / .xls) ou CSV — até 2.000 linhas por vez
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-muted)] shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* idle / error — zona de drop */}
          {(step === 'idle' || step === 'error') && (
            <div className="p-5 space-y-4">

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={[
                  'relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-150 select-none',
                  dragOver
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/8 scale-[1.01]'
                    : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/60 hover:bg-[var(--color-surface)]'
                ].join(' ')}
              >
                <div className={[
                  'w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-colors',
                  dragOver ? 'bg-[var(--color-primary)]/15' : 'bg-[var(--color-surface)]'
                ].join(' ')}>
                  <Upload size={24} className={dragOver ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'} />
                </div>
                <p className="text-sm font-semibold text-[var(--color-text)] mb-1">
                  {dragOver ? 'Solte o arquivo aqui' : 'Arraste o arquivo ou clique para selecionar'}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Formatos aceitos: <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.csv</strong>
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => e.target.files[0] && parseFile(e.target.files[0])}
                />
              </div>

              {/* Erro */}
              {step === 'error' && errMsg && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                  <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-300">{errMsg}</p>
                </div>
              )}

              {/* Baixar modelo */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)]">Modelo de planilha</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                    Baixe o Excel com as colunas corretas e 6 exemplos
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); downloadTemplate() }}
                  className="shrink-0 flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface)] text-[var(--color-text)] transition-colors"
                >
                  <Download size={14} />
                  Baixar modelo
                </button>
              </div>

              {/* Campos aceitos — colapsável */}
              <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
                <button
                  onClick={() => setShowDocs(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Info size={14} className="text-[var(--color-primary)]" />
                    Colunas aceitas na planilha
                  </span>
                  <span className="text-[var(--color-text-muted)] text-xs">{showDocs ? '▲' : '▼'}</span>
                </button>
                {showDocs && (
                  <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                    {FIELD_DOCS.map(({ col, desc }) => (
                      <div key={col} className="flex items-center gap-3 px-4 py-2.5">
                        <code className="text-xs font-mono font-semibold text-[var(--color-primary)] bg-[var(--color-primary)]/8 px-2 py-0.5 rounded shrink-0">
                          {col}
                        </code>
                        <span className="text-xs text-[var(--color-text-muted)]">{desc}</span>
                      </div>
                    ))}
                    <div className="px-4 py-3 bg-[var(--color-bg-subtle)]">
                      <p className="text-xs text-[var(--color-text-muted)]">
                        💡 Para produtos com grade, repita o <strong>mesmo código-base</strong> em várias linhas,
                        cada uma com uma combinação diferente de variações.
                        Use um código único por combinação (ex: CAM-001-P-PT).
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* parsing */}
          {step === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 size={36} className="animate-spin text-[var(--color-primary)]" />
              <p className="text-sm text-[var(--color-text-muted)]">Lendo arquivo…</p>
            </div>
          )}

          {/* preview */}
          {step === 'preview' && validated && (
            <div className="p-5 space-y-4">

              {/* Info arquivo */}
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[var(--color-primary)]/8 border border-[var(--color-primary)]/20">
                <FileSpreadsheet size={18} className="text-[var(--color-primary)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text)] truncate">{file?.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {rows.length} linha{rows.length !== 1 ? 's' : ''} encontrada{rows.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button onClick={reset} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                  <X size={14} />
                </button>
              </div>

              {/* Resumo da validação */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 text-center">
                  <p className="text-xl font-bold text-green-600">{validated.valid.length}</p>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                    {validated.valid.length === 1 ? 'Linha válida' : 'Linhas válidas'}
                  </p>
                </div>
                <div className={[
                  'p-3.5 rounded-xl border text-center',
                  hasErrors
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
                    : 'bg-[var(--color-bg-subtle)] border-[var(--color-border)]'
                ].join(' ')}>
                  <p className={['text-xl font-bold', hasErrors ? 'text-amber-600' : 'text-[var(--color-text-muted)]'].join(' ')}>
                    {validated.invalid.length}
                  </p>
                  <p className={['text-xs mt-0.5', hasErrors ? 'text-amber-700 dark:text-amber-400' : 'text-[var(--color-text-muted)]'].join(' ')}>
                    {validated.invalid.length === 1 ? 'Linha com problema' : 'Linhas com problema'}
                  </p>
                </div>
              </div>

              {/* Erros de validação */}
              {hasErrors && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      Estas linhas serão ignoradas na importação
                    </p>
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-[var(--color-border)]">
                    {validated.invalid.map((e, i) => (
                      <div key={i} className="px-4 py-2.5 flex items-start gap-2">
                        <span className="text-xs font-semibold text-[var(--color-text-muted)] shrink-0 mt-0.5">L{e.linha}</span>
                        <div>
                          {e.nome && e.nome !== '—' && (
                            <span className="text-xs font-medium text-[var(--color-text)] mr-2">{e.nome}</span>
                          )}
                          <span className="text-xs text-amber-700 dark:text-amber-400">
                            {(e.erros || [e.erro]).join(' · ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview tabela */}
              <div>
                <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">
                  Prévia — primeiras {Math.min(5, validated.valid.length)} linhas válidas
                </p>
                <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[var(--color-surface)]">
                        {Object.keys(rows[0]).slice(0, 6).map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-[var(--color-text-muted)] whitespace-nowrap border-b border-[var(--color-border)]">
                            {h}
                          </th>
                        ))}
                        {Object.keys(rows[0]).length > 6 && (
                          <th className="px-3 py-2 text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                            +{Object.keys(rows[0]).length - 6}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {validated.valid.slice(0, 5).map(({ row, linha }) => (
                        <tr key={linha} className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)]">
                          {Object.keys(rows[0]).slice(0, 6).map(h => (
                            <td key={h} className="px-3 py-2 text-[var(--color-text)] truncate max-w-[120px]">
                              {row[h] ?? ''}
                            </td>
                          ))}
                          {Object.keys(rows[0]).length > 6 && <td className="px-3 py-2 text-[var(--color-text-muted)]">…</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {validated.valid.length > 5 && (
                    <p className="px-3 py-2 text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)]">
                      … e mais {validated.valid.length - 5} linha{validated.valid.length - 5 !== 1 ? 's' : ''} válida{validated.valid.length - 5 !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* loading */}
          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-5 px-5">
              <div className="relative w-16 h-16">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="var(--color-border)" strokeWidth="4" />
                  <circle
                    cx="32" cy="32" r="28" fill="none"
                    stroke="var(--color-primary)" strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                    style={{ transition: 'stroke-dashoffset 0.2s ease' }}
                  />
                </svg>
                <Loader2 size={24} className="absolute inset-0 m-auto animate-spin text-[var(--color-primary)]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  Importando {validated?.valid?.length ?? rows.length} produto{(validated?.valid?.length ?? rows.length) !== 1 ? 's' : ''}…
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Aguarde, isso pode levar alguns segundos</p>
              </div>
            </div>
          )}

          {/* done */}
          {step === 'done' && result && (
            <div className="p-5 space-y-4">
              <div className="flex flex-col items-center py-6 gap-2 text-center">
                <CheckCircle size={48} className="text-green-500" />
                <p className="text-base font-bold text-[var(--color-text)]">Importação concluída!</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {result.inserted + result.updated} produto{result.inserted + result.updated !== 1 ? 's' : ''} processado{result.inserted + result.updated !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ['Inseridos', result.inserted, 'text-green-600', 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900'],
                  ['Atualizados', result.updated, 'text-blue-600', 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900'],
                  ['Ignorados', result.skipped, 'text-amber-600', 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'],
                ].map(([label, count, color, cls]) => (
                  <div key={label} className={`p-4 rounded-xl border text-center ${cls}`}>
                    <p className={`text-2xl font-bold ${color}`}>{count}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              {result.errors?.length > 0 && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      {result.errors.length} linha{result.errors.length !== 1 ? 's' : ''} com erro na importação
                    </p>
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-[var(--color-border)]">
                    {result.errors.map((e, i) => (
                      <div key={i} className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">
                        <span className="font-semibold text-[var(--color-text)]">Linha {e.linha}:</span>{' '}
                        {e.nome && <span className="text-[var(--color-text)] mr-1">{e.nome} —</span>}
                        {e.erro}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-[var(--color-border)] flex justify-end gap-3 shrink-0">
          {step === 'done' ? (
            <button
              onClick={handleClose}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
            >
              Concluir
            </button>
          ) : (
            <>
              <button
                onClick={handleClose}
                disabled={step === 'loading'}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-40 transition-colors"
              >
                Cancelar
              </button>
              {step === 'preview' && (
                <button
                  onClick={handleImport}
                  disabled={!canImport}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  <Upload size={15} />
                  Importar {validated?.valid?.length} produto{validated?.valid?.length !== 1 ? 's' : ''}
                  {hasErrors && <span className="text-white/70 text-xs">({validated?.invalid?.length} ignorados)</span>}
                </button>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  )
}
