/**
 * pages/settings/SettingsPage.jsx
 *
 * Painel de tema do tenant — Sprint 2 Tarefa 8.
 *
 * Seções:
 *   1. Upload de logo
 *   2. Color picker — cor primária (hex + palette de sugestões)
 *   3. Seletor de mood — light / dark / warm / cool
 *   4. Seletor de tipografia — 6 pares
 *   5. Seletor de radius — sharp / soft / round
 *   6. Preview ao vivo (painel direito em desktop, inline em mobile)
 *   7. Botão Salvar — persiste no banco via /api/tenant/theme
 *
 * O preview usa setTenantTheme() do ThemeProvider para aplicar
 * as mudanças em tempo real em TODA a UI sem precisar salvar.
 * Ao sair sem salvar, o tema original é restaurado.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, X, RefreshCw, Save,
  Check, Palette, Type, Circle,
  RotateCcw, BarChart2,
} from 'lucide-react'
import { useTheme }        from '@aura/theme'
import { useTenantTheme }  from '../../hooks/useTenantTheme.js'
import { Card, Button }    from '@aura/ui'
import { FONT_PAIRS, RADIUS_TOKENS, MOOD_PALETTES } from '@aura/theme'

/* ─── Paleta de sugestões de cor primária ─── */
const COLOR_PRESETS = [
  '#0284C7', // Aura Blue
  '#7C3AED', // Violet
  '#059669', // Green
  '#DC2626', // Red
  '#D97706', // Amber
  '#DB2777', // Pink
  '#0891B2', // Cyan
  '#65A30D', // Lime
  '#1D4ED8', // Indigo
  '#374151', // Gray
]

/* ─── Labels legíveis ─── */
const MOOD_OPTIONS = [
  { value: 'light', label: 'Claro',   desc: 'Superfícies brancas e claras',     emoji: '☀️' },
  { value: 'dark',  label: 'Escuro',  desc: 'Quase preto, alto contraste',      emoji: '🌑' },
  { value: 'warm',  label: 'Quente',  desc: 'Tons terracota e âmbar',            emoji: '🍂' },
  { value: 'cool',  label: 'Frio',    desc: 'Azul gelo, atmosfera tech',         emoji: '🧊' },
]

const FONT_OPTIONS = [
  { value: 'modern',   label: 'Moderno',   sample: 'Inter',            desc: 'Limpo e versátil'       },
  { value: 'elegant',  label: 'Elegante',  sample: 'Playfair Display', desc: 'Serifado sofisticado'   },
  { value: 'friendly', label: 'Amigável',  sample: 'Nunito',           desc: 'Arredondado e caloroso' },
  { value: 'bold',     label: 'Forte',     sample: 'Sora',             desc: 'Presença e impacto'     },
  { value: 'minimal',  label: 'Mínimo',    sample: 'DM Sans',          desc: 'Espaçado e respirado'   },
  { value: 'artisan',  label: 'Artesanal', sample: 'Fraunces',         desc: 'Editorial e artesanal'  },
]

const RADIUS_OPTIONS = [
  { value: 'sharp', label: 'Nítido',     desc: 'Ângulos retos, corporativo', example: '2px' },
  { value: 'soft',  label: 'Suave',      desc: 'Cantos levemente arredond.', example: '8px' },
  { value: 'round', label: 'Arredondado',desc: 'Fluido e moderno',           example: '20px' },
]

/* ─── Preview mini-card ─── */
function PreviewCard({ theme, logoUrl }) {
  const primary = theme.primaryColor
  const radiusMap = { sharp: '4px', soft: '10px', round: '18px' }
  const rad = radiusMap[theme.radius] ?? '10px'

  return (
    <div
      className="overflow-hidden border border-[var(--color-border)] shadow-[var(--shadow-md)]"
      style={{ borderRadius: rad, fontFamily: 'var(--font-body)' }}
    >
      {/* Header fictício */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="w-6 h-6 object-contain" style={{ borderRadius: '4px' }} />
        ) : (
          <div
            className="w-6 h-6 flex items-center justify-center text-white text-[10px] font-bold"
            style={{ backgroundColor: primary, borderRadius: '4px' }}
          >
            A
          </div>
        )}
        <span className="text-xs font-semibold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-heading)' }}>
          Aura ERP
        </span>
        <div className="ml-auto flex gap-1.5">
          {['bg-red-400','bg-yellow-400','bg-green-400'].map(c => (
            <div key={c} className={`w-2.5 h-2.5 rounded-full ${c}`} />
          ))}
        </div>
      </div>

      {/* Body fictício */}
      <div className="bg-[var(--color-bg)] p-4 space-y-3">
        {/* KPI card fictício */}
        <div
          className="p-3 border border-[var(--color-border)] bg-[var(--color-bg-subtle)]"
          style={{ borderRadius: rad }}
        >
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Receita hoje</p>
          <p className="text-lg font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-heading)' }}>
            R$ 14.720
          </p>
          <p className="text-[10px] text-[var(--color-success)] mt-0.5">+8.3% vs. ontem</p>
        </div>

        {/* Badge + botão fictícios */}
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 text-white"
            style={{ backgroundColor: primary, borderRadius: rad }}
          >
            Novo pedido
          </span>
          <span
            className="text-[10px] font-medium px-2 py-0.5 border border-[var(--color-border)] text-[var(--color-text-muted)]"
            style={{ borderRadius: rad }}
          >
            Filtrar
          </span>
        </div>

        {/* Barra de nav fictícia */}
        <div className="flex gap-1">
          {['Dashboard','Pedidos','Clientes'].map((item, i) => (
            <div
              key={item}
              className="flex-1 py-1.5 text-center text-[9px] font-medium"
              style={{
                borderRadius: rad,
                backgroundColor: i === 0 ? primary : 'transparent',
                color: i === 0 ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Seção com título ─── */
function Section({ icon: Icon, title, children }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className="text-[var(--color-primary)]" />
        <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
      </div>
      {children}
    </Card>
  )
}

/* ─── Página ─── */
export function SettingsPage() {
  const navigate               = useNavigate()
  const { theme, setTenantTheme, isDark } = useTheme()
  const { tenantInfo }         = useTenantTheme()

  /* Estado local do formulário — começa com o tema atual */
  const [form,     setForm]     = useState({ ...theme, ga4MeasurementId: theme.ga4MeasurementId ?? '', metaPixelId: theme.metaPixelId ?? '' })
  const [logoUrl,  setLogoUrl]  = useState(tenantInfo?.logoUrl ?? null)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [dirty,    setDirty]    = useState(false)

  /* Salva o tema original para restaurar se sair sem salvar */
  const originalTheme = useRef({ ...theme })
  const originalLogo  = useRef(tenantInfo?.logoUrl ?? null)

  /* Aplica mudanças em tempo real na UI */
  useEffect(() => {
    setTenantTheme(form)
  }, [form, setTenantTheme])

  /* Restaura tema original ao desmontar se não salvou */
  useEffect(() => {
    return () => {
      // Só restaura se não salvou
      if (!savedRef.current) {
        setTenantTheme(originalTheme.current)
      }
    }
  }, [setTenantTheme])

  const savedRef = useRef(false)

  const update = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setDirty(true)
    setSaved(false)
  }, [])

  /* ─── Upload logo ─── */
  const logoInputRef = useRef(null)
  const handleLogo = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setLogoUrl(reader.result)
      setDirty(true)
    }
    reader.readAsDataURL(file)
  }

  /* ─── Reset ─── */
  const handleReset = () => {
    const orig = originalTheme.current
    setForm({ ...orig })
    setLogoUrl(originalLogo.current)
    setDirty(false)
    setSaved(false)
  }

  /* ─── Salvar ─── */
  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/tenant/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, logoUrl }),
      })
    } catch {
      // mock: aceita silenciosamente
    } finally {
      // Atualiza a "original" para o valor salvo
      originalTheme.current = { ...form }
      originalLogo.current  = logoUrl
      savedRef.current = true
      setSaving(false)
      setSaved(true)
      setDirty(false)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  return (
    <div className="space-y-5 max-w-screen-xl">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">Tema da loja</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            Personalize a aparência do seu ERP e loja B2B
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors"
            >
              <RotateCcw size={13} /> Resetar
            </button>
          )}
          <Button onClick={handleSave} disabled={saving || (!dirty && !saved)}>
            {saved
              ? <><Check size={14} /> Salvo!</>
              : saving
              ? <><RefreshCw size={14} className="animate-spin" /> Salvando…</>
              : <><Save size={14} /> Salvar tema</>
            }
          </Button>
        </div>
      </div>

      {/* ── Grid: formulário + preview ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Formulário (2/3) ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* ─── Logo ─── */}
          <Section icon={Upload} title="Logo da empresa">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Preview atual */}
              <div
                className="w-20 h-20 rounded-xl border-2 border-dashed border-[var(--color-border)] flex items-center justify-center overflow-hidden bg-[var(--color-bg-subtle)] shrink-0 cursor-pointer hover:border-[var(--color-primary)] transition-colors"
                onClick={() => logoInputRef.current?.click()}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <Upload size={20} className="text-[var(--color-text-disabled)]" />
                )}
              </div>
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm text-[var(--color-text-muted)] mb-2">
                  PNG ou SVG transparente. Recomendado: 200×60px.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="h-9 px-4 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors"
                  >
                    {logoUrl ? 'Trocar logo' : 'Enviar logo'}
                  </button>
                  {logoUrl && (
                    <button
                      onClick={() => { setLogoUrl(null); setDirty(true) }}
                      className="h-9 px-3 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-red-500 hover:border-red-300 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogo} className="hidden" />
            </div>
          </Section>

          {/* ─── Cor primária ─── */}
          <Section icon={Palette} title="Cor primária">
            {/* Presets */}
            <div className="flex flex-wrap gap-2 mb-4">
              {COLOR_PRESETS.map(color => (
                <button
                  key={color}
                  onClick={() => update('primaryColor', color)}
                  title={color}
                  className="relative w-9 h-9 rounded-xl border-2 transition-all duration-150 hover:scale-110"
                  style={{
                    backgroundColor: color,
                    borderColor: form.primaryColor === color ? 'var(--color-text)' : 'transparent',
                  }}
                >
                  {form.primaryColor === color && (
                    <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>

            {/* Cor personalizada */}
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={e => update('primaryColor', e.target.value)}
                  className="w-11 h-11 rounded-xl border border-[var(--color-border)] cursor-pointer p-0.5 bg-[var(--color-bg)]"
                  title="Cor personalizada"
                />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={form.primaryColor}
                  onChange={e => {
                    const v = e.target.value
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) update('primaryColor', v)
                  }}
                  placeholder="#0284C7"
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Qualquer cor hex válida</p>
              </div>
              {/* Swatch aplicado */}
              <div
                className="w-11 h-11 rounded-xl shrink-0 border border-[var(--color-border)]"
                style={{ backgroundColor: form.primaryColor }}
                title="Preview da cor"
              />
            </div>
          </Section>

          {/* ─── Mood ─── */}
          <Section icon={Palette} title="Estilo de superfície (mood)">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {MOOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => update('mood', opt.value)}
                  className={`
                    flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center
                    transition-all duration-150
                    ${form.mood === opt.value
                      ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-blue-950'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
                    }
                  `}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <div>
                    <p className={`text-xs font-semibold ${form.mood === opt.value ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 leading-tight">
                      {opt.desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </Section>

          {/* ─── Tipografia ─── */}
          <Section icon={Type} title="Tipografia">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FONT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => update('fontPair', opt.value)}
                  className={`
                    flex items-center gap-3 p-3.5 rounded-xl border-2 text-left
                    transition-all duration-150
                    ${form.fontPair === opt.value
                      ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-blue-950'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
                    }
                  `}
                >
                  {/* Check */}
                  <div className={`
                    w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0
                    ${form.fontPair === opt.value ? 'border-[var(--color-primary)] bg-[var(--color-primary)]' : 'border-[var(--color-border)]'}
                  `}>
                    {form.fontPair === opt.value && <Check size={10} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${form.fontPair === opt.value ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">{opt.sample}</p>
                    <p className="text-[10px] text-[var(--color-text-disabled)] mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </Section>

          {/* ─── Radius ─── */}
          <Section icon={Circle} title="Arredondamento dos cantos">
            <div className="grid grid-cols-3 gap-3">
              {RADIUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => update('radius', opt.value)}
                  className={`
                    flex flex-col items-center gap-3 p-4 rounded-xl border-2
                    transition-all duration-150
                    ${form.radius === opt.value
                      ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-blue-950'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
                    }
                  `}
                >
                  {/* Ilustração do radius */}
                  <div
                    className="w-12 h-12 border-2 shrink-0"
                    style={{
                      borderRadius: opt.example,
                      borderColor: form.radius === opt.value ? 'var(--color-primary)' : 'var(--color-border)',
                      backgroundColor: form.radius === opt.value ? 'var(--color-primary)' : 'var(--color-bg-subtle)',
                      opacity: form.radius === opt.value ? 0.2 : 1,
                    }}
                  />
                  <div className="text-center">
                    <p className={`text-xs font-semibold ${form.radius === opt.value ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 leading-tight">
                      {opt.desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </Section>


          {/* ─── Analytics ─── */}
          <Section icon={BarChart2} title="Analytics & Pixels">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                  GA4 Measurement ID
                </label>
                <input
                  type="text"
                  placeholder="G-XXXXXXXXXX"
                  value={form.ga4MeasurementId ?? ''}
                  onChange={e => update('ga4MeasurementId', e.target.value.trim())}
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Encontrado em GA4 → Admin → Fluxos de dados → Seu ID (ex: G-ABC1234567).
                  Será injetado na loja B2B e no ERP.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                  Meta Pixel ID
                </label>
                <input
                  type="text"
                  placeholder="123456789012345"
                  value={form.metaPixelId ?? ''}
                  onChange={e => update('metaPixelId', e.target.value.trim().replace(/\D/g, ''))}
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Encontrado no Gerenciador de Eventos do Facebook → Pixels → Seu ID (somente números).
                  Será injetado apenas na loja B2B.
                </p>
              </div>
              {(form.ga4MeasurementId || form.metaPixelId) && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 text-xs text-green-400 flex items-center gap-2">
                  <Check size={12} />
                  Scripts serão injetados na loja após salvar. Cache pode levar até 60s para atualizar.
                </div>
              )}
            </div>
          </Section>

        </div>

        {/* ── Preview (1/3) ── */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-3">
            <Card className="p-5">
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-4">
                Preview em tempo real
              </p>
              <PreviewCard theme={form} logoUrl={logoUrl} />

              {/* Info do tema atual */}
              <div className="mt-4 space-y-1.5">
                {[
                  { label: 'Cor primária', value: form.primaryColor },
                  { label: 'Mood',         value: MOOD_OPTIONS.find(m => m.value === form.mood)?.label },
                  { label: 'Tipografia',   value: FONT_OPTIONS.find(f => f.value === form.fontPair)?.label },
                  { label: 'Cantos',       value: RADIUS_OPTIONS.find(r => r.value === form.radius)?.label },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-[var(--color-text-muted)]">{row.label}</span>
                    <div className="flex items-center gap-1.5">
                      {row.label === 'Cor primária' && (
                        <div className="w-3 h-3 rounded-full border border-[var(--color-border)]" style={{ backgroundColor: form.primaryColor }} />
                      )}
                      <span className="font-medium text-[var(--color-text)]">{row.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Nota de preview */}
            <p className="text-xs text-[var(--color-text-muted)] text-center px-2">
              O preview é aplicado em toda a interface em tempo real. Clique em "Salvar tema" para persistir.
            </p>
          </div>
        </div>

      </div>

      {/* ── Rodapé mobile: botão salvar fixo ── */}
      {dirty && (
        <div className="fixed bottom-20 md:bottom-6 right-4 z-30 lg:hidden">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 h-11 px-5 rounded-full shadow-lg text-sm font-semibold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60 transition-colors"
          >
            {saving ? <><RefreshCw size={14} className="animate-spin" /> Salvando…</> : <><Save size={14} /> Salvar tema</>}
          </button>
        </div>
      )}

    </div>
  )
}
