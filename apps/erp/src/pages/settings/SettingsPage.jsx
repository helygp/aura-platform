/**
 * pages/settings/SettingsPage.jsx
 *
 * Painel de configurações do tenant — Sprint #37.
 *
 * Abas:
 *   Experiência — logo, nome de exibição, cor, mood, tipografia, radius, analytics
 *   Loja        — habilitar/desabilitar loja B2B
 *   WhatsApp    — configurar credenciais WAHA + gerenciar conexão
 *
 * Visível apenas para perfil admin (controlado em navItems.js).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Upload, X, RefreshCw, Save, Check, Palette, Type, Circle, Send,
  RotateCcw, BarChart2, Tag, Store, MessageCircle, Wifi, WifiOff,
  Link, Key, Hash, QrCode, Phone, AlertCircle, ShoppingBag, LayoutList, LayoutGrid,
} from 'lucide-react'
import { useTheme }        from '@aura/theme'
import { useTenantTheme }  from '../../hooks/useTenantTheme.js'
import { Card, Button }    from '@aura/ui'
import { PhoneInput }     from '../whatsapp/components/PhoneInput.jsx'
import { FONT_PAIRS, RADIUS_TOKENS, MOOD_PALETTES } from '@aura/theme'

/* ─── Paleta de sugestões de cor primária ─── */
const COLOR_PRESETS = [
  '#0284C7','#7C3AED','#059669','#DC2626','#D97706',
  '#DB2777','#0891B2','#65A30D','#1D4ED8','#374151',
]

/* ─── Labels legíveis ─── */
const MOOD_OPTIONS = [
  { value: 'light', label: 'Claro',   desc: 'Superfícies brancas e claras',   emoji: '☀️' },
  { value: 'dark',  label: 'Escuro',  desc: 'Quase preto, alto contraste',    emoji: '🌑' },
  { value: 'warm',  label: 'Quente',  desc: 'Tons terracota e âmbar',          emoji: '🍂' },
  { value: 'cool',  label: 'Frio',    desc: 'Azul gelo, atmosfera tech',       emoji: '🧊' },
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
  { value: 'sharp', label: 'Nítido',      desc: 'Ângulos retos, corporativo', example: '2px'  },
  { value: 'soft',  label: 'Suave',       desc: 'Cantos levemente arredond.', example: '8px'  },
  { value: 'round', label: 'Arredondado', desc: 'Fluido e moderno',           example: '20px' },
]

/* ─── Preview mini-card (sem alteração) ─── */
function PreviewCard({ theme, logoUrl, displayName }) {
  const primary = theme.primaryColor
  const radiusMap = { sharp: '4px', soft: '10px', round: '18px' }
  const rad = radiusMap[theme.radius] ?? '10px'
  const label = displayName?.trim() || 'Aura ERP'
  return (
    <div className="overflow-hidden border border-[var(--color-border)] shadow-[var(--shadow-md)]" style={{ borderRadius: rad, fontFamily: 'var(--font-body)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="w-6 h-6 object-contain" style={{ borderRadius: '4px' }} />
        ) : (
          <div className="w-6 h-6 flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: primary, borderRadius: '4px' }}>
            {label.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-xs font-semibold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-heading)' }}>{label}</span>
        <div className="ml-auto flex gap-1.5">
          {['bg-red-400','bg-yellow-400','bg-green-400'].map(c => <div key={c} className={`w-2.5 h-2.5 rounded-full ${c}`} />)}
        </div>
      </div>
      <div className="bg-[var(--color-bg)] p-4 space-y-3">
        <div className="p-3 border border-[var(--color-border)] bg-[var(--color-bg-subtle)]" style={{ borderRadius: rad }}>
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Receita hoje</p>
          <p className="text-lg font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-heading)' }}>R$ 14.720</p>
          <p className="text-[10px] text-[var(--color-success)] mt-0.5">+8.3% vs. ontem</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold px-2 py-0.5 text-white" style={{ backgroundColor: primary, borderRadius: rad }}>Novo pedido</span>
          <span className="text-[10px] font-medium px-2 py-0.5 border border-[var(--color-border)] text-[var(--color-text-muted)]" style={{ borderRadius: rad }}>Filtrar</span>
        </div>
        <div className="flex gap-1">
          {['Dashboard','Pedidos','Clientes'].map((item, i) => (
            <div key={item} className="flex-1 py-1.5 text-center text-[9px] font-medium" style={{ borderRadius: rad, backgroundColor: i === 0 ? primary : 'transparent', color: i === 0 ? '#fff' : 'var(--color-text-muted)' }}>{item}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Section com título ─── */
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

/* ─── Badge de status WhatsApp ─── */
function WppStatusBadge({ status }) {
  const map = {
    WORKING:       { label: 'Conectado',     color: 'text-green-500',  bg: 'bg-green-500/10'  },
    SCAN_QR_CODE:  { label: 'Aguardando QR', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    STARTING:      { label: 'Iniciando…',    color: 'text-blue-500',   bg: 'bg-blue-500/10'   },
    STOPPED:       { label: 'Desconectado',  color: 'text-red-400',    bg: 'bg-red-500/10'    },
    FAILED:        { label: 'Erro',          color: 'text-red-500',    bg: 'bg-red-500/10'    },
  }
  const s = map[status] ?? map.STOPPED
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.color} ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.color.replace('text-','bg-')}`} />
      {s.label}
    </span>
  )
}

/* ─── Página principal ─── */

/* ─── Toggle de viewMode para o novo pedido (salvo em localStorage) ─── */
function OrderViewToggle() {
  const [mode, setMode] = React.useState(() => {
    try { return localStorage.getItem('aura_order_view') ?? 'list' } catch { return 'list' }
  })
  const pick = (v) => {
    try { localStorage.setItem('aura_order_view', v) } catch {}
    setMode(v)
  }
  const OPTIONS = [
    { value: 'list',   icon: LayoutList, label: 'Lista',  desc: 'Uma linha por SKU com estoque e stepper' },
    { value: 'matrix', icon: LayoutGrid, label: 'Grade',  desc: 'Tabela Cor x Tamanho, compacta para muitos SKUs' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3">
      {OPTIONS.map(opt => {
        const Icon   = opt.icon
        const active = mode === opt.value
        return (
          <button key={opt.value} onClick={() => pick(opt.value)}
            className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 text-center transition-all duration-150 ${
              active ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-blue-950' : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
            }`}
          >
            <Icon size={22} className={active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'} />
            <div>
              <p className={"text-xs font-semibold " + (active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]')}>{opt.label}</p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 leading-tight">{opt.desc}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('experiencia')

  /* ─── Theme (Experiência) ─── */
  const { theme, setTenantTheme } = useTheme()
  const { tenantInfo }            = useTenantTheme()

  const [form,        setForm]       = useState({ ...theme, ga4MeasurementId: theme.ga4MeasurementId ?? '', metaPixelId: theme.metaPixelId ?? '' })
  const [logoUrl,     setLogoUrl]    = useState(tenantInfo?.logoUrl ?? null)
  const [displayName, setDisplayName] = useState(tenantInfo?.displayName ?? '')
  const [saving,      setSaving]     = useState(false)
  const [saved,       setSaved]      = useState(false)
  const [dirty,       setDirty]      = useState(false)
  const originalTheme = useRef({ ...theme })
  const originalLogo  = useRef(tenantInfo?.logoUrl ?? null)
  const savedRef      = useRef(false)

  useEffect(() => { setTenantTheme(form) }, [form, setTenantTheme])
  useEffect(() => {
    return () => { if (!savedRef.current) setTenantTheme(originalTheme.current) }
  }, [setTenantTheme])

  // Sync displayName quando tenantInfo carrega
  useEffect(() => {
    if (tenantInfo?.displayName != null) setDisplayName(tenantInfo.displayName)
  }, [tenantInfo?.displayName])

  const update = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setDirty(true)
    setSaved(false)
  }, [])

  const logoInputRef = useRef(null)
  const handleLogo = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { setLogoUrl(reader.result); setDirty(true) }
    reader.readAsDataURL(file)
  }

  const handleReset = () => {
    setForm({ ...originalTheme.current })
    setLogoUrl(originalLogo.current)
    setDisplayName(tenantInfo?.displayName ?? '')
    setDirty(false)
    setSaved(false)
  }

  const handleSaveTheme = async () => {
    setSaving(true)
    try {
      await Promise.all([
        fetch('/api/tenant/theme', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ...form, logoUrl }),
        }),
        fetch('/api/tenant/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ displayName: displayName.trim() || null }),
        }),
      ])
    } catch {}
    originalTheme.current = { ...form }
    originalLogo.current  = logoUrl
    savedRef.current = true
    // Invalida cache para Sidebar refletir novo nome
    try { sessionStorage.removeItem('aura-tenant-theme') } catch {}
    setSaving(false)
    setSaved(true)
    setDirty(false)
    setTimeout(() => setSaved(false), 3000)
  }

  /* ─── Loja ─── */
  const [storeEnabled, setStoreEnabled] = useState(tenantInfo?.storeEnabled ?? true)
  const [lojaSaving,   setLojaSaving]   = useState(false)
  const [lojaSaved,    setLojaSaved]    = useState(false)

  useEffect(() => {
    if (tenantInfo?.storeEnabled != null) setStoreEnabled(tenantInfo.storeEnabled)
  }, [tenantInfo?.storeEnabled])

  const handleSaveLoja = async () => {
    setLojaSaving(true)
    try {
      await fetch('/api/tenant/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ storeEnabled }),
      })
      setLojaSaved(true)
      setTimeout(() => setLojaSaved(false), 3000)
    } catch {}
    setLojaSaving(false)
  }

  /* ─── WhatsApp ─── */
  const [wppStatus,    setWppStatus]    = useState(null)
  const [wppLoading,   setWppLoading]   = useState(false)
  const [wppActing,    setWppActing]    = useState(false)
  const [wppQr,        setWppQr]        = useState(null)
  const [wppConnected, setWppConnected] = useState(false)  // feedback "Conectado!"
  const qrPollRef = useRef(null)

  // Aprovador
  const [approverPhone, setApproverPhone] = useState('')
  const [approverDirty, setApproverDirty] = useState(false)
  const [approverSaving, setApproverSaving] = useState(false)
  const [approverSaved, setApproverSaved] = useState(false)

  const loadWppStatus = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setWppLoading(true)
    try {
      const res = await fetch('/api/whatsapp/session', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setWppStatus(data)
        if (data.status === 'WORKING') {
          setWppQr(null)
          setWppConnected(true)
          setTimeout(() => setWppConnected(false), 4000)
          // Invalida cache do menu WhatsApp para aparecer imediatamente
          try { sessionStorage.removeItem('aura_wpp_menu_status') } catch {}
        }
      }
    } catch {}
    if (!silent) setWppLoading(false)
  }, [])

  const loadApprover = useCallback(async () => {
    try {
      const res = await fetch('/api/tenant/whatsapp/approver', { credentials: 'include' })
      if (res.ok) {
        const { approver_phone } = await res.json()
        setApproverPhone(approver_phone ?? '')
        setApproverDirty(false)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (activeTab === 'whatsapp') { loadWppStatus(); loadApprover() }
  }, [activeTab, loadWppStatus, loadApprover])

  // Polling automático enquanto QR estiver visível — verifica a cada 3s
  useEffect(() => {
    if (wppQr) {
      qrPollRef.current = setInterval(() => loadWppStatus({ silent: true }), 3000)
    } else {
      clearInterval(qrPollRef.current)
    }
    return () => clearInterval(qrPollRef.current)
  }, [wppQr, loadWppStatus])

  const handleSaveApprover = async () => {
    setApproverSaving(true)
    try {
      const res = await fetch('/api/tenant/whatsapp/approver', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ approver_phone: approverPhone || null }),
      })
      if (res.ok) {
        setApproverSaved(true)
        setApproverDirty(false)
        setTimeout(() => setApproverSaved(false), 3000)
      } else {
        const err = await res.json().catch(() => ({}))
        alert('Erro ao salvar: ' + (err.error ?? res.statusText))
      }
    } catch (e) {
      alert('Erro: ' + e.message)
    }
    setApproverSaving(false)
  }

  const [wppError, setWppError] = useState(null)

  /* Envio avulso */
  const [sendTo,      setSendTo]      = useState('')
  const [sendMsg,     setSendMsg]     = useState('')
  const [sendStatus,  setSendStatus]  = useState(null)
  const [sendSending, setSendSending] = useState(false)

  const handleManualSend = async () => {
    if (!sendTo || !sendMsg.trim()) return
    setSendSending(true); setSendStatus(null)
    try {
      const e164 = sendTo.startsWith('55') ? sendTo : '55' + sendTo.replace(/\D/g, '')
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: e164, message: sendMsg.trim() }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText)
      setSendStatus('ok'); setSendMsg('')
      setTimeout(() => setSendStatus(null), 4000)
    } catch (err) {
      setSendStatus('error:' + err.message)
    }
    setSendSending(false)
  }

  const handleConnectWpp = async () => {
    setWppActing(true)
    setWppQr(null)
    setWppError(null)
    try {
      const r = await fetch('/api/whatsapp/session/start', { method: 'POST', credentials: 'include' })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        if (r.status === 503 || /não configurad/i.test(err?.error ?? '')) {
          setWppError('WhatsApp ainda não foi configurado pela Aura para este ambiente. Entre em contato com o suporte.')
        } else {
          setWppError(err?.error ?? `Erro ao conectar (HTTP ${r.status})`)
        }
        setWppActing(false)
        return
      }
      await new Promise(r => setTimeout(r, 2500))
      await loadWppStatus()
      const s = await fetch('/api/whatsapp/session', { credentials: 'include' }).then(r => r.json()).catch(() => null)
      if (s?.status === 'SCAN_QR_CODE') {
        const qrRes = await fetch('/api/whatsapp/qr', { credentials: 'include' })
        if (qrRes.ok) { const { qr } = await qrRes.json(); setWppQr(qr) }
      }
    } catch (e) {
      setWppError('Falha na conexão: ' + e.message)
    }
    setWppActing(false)
  }

  const handleDisconnectWpp = async () => {
    setWppActing(true)
    try {
      await fetch('/api/whatsapp/session/stop', { method: 'POST', credentials: 'include' })
      await loadWppStatus()
      setWppQr(null)
    } catch {}
    setWppActing(false)
  }

  /* ─── Tabs ─── */
  const TABS = [
    { id: 'experiencia', label: 'Experiência' },
    { id: 'loja',        label: 'Loja'        },
    { id: 'whatsapp',    label: 'WhatsApp'    },
    { id: 'pedidos',     label: 'Pedidos'     },
  ]

  return (
    <div className="space-y-5 max-w-screen-xl">

      {/* ── Header geral ── */}
      <div>
        <h2 className="text-lg font-bold text-[var(--color-text)]">Configurações</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Personalize o ERP, a loja B2B e as integrações do seu tenant</p>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-0 border-b border-[var(--color-border)]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════
          ABA EXPERIÊNCIA
      ══════════════════════════════════════════════ */}
      {activeTab === 'experiencia' && (
        <>
          {/* Botões salvar */}
          <div className="flex items-center justify-end gap-2 flex-wrap">
            {dirty && (
              <button onClick={handleReset} className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors">
                <RotateCcw size={13} /> Resetar
              </button>
            )}
            <Button onClick={handleSaveTheme} disabled={saving || (!dirty && !saved)}>
              {saved    ? <><Check size={14} /> Salvo!</>
               : saving ? <><RefreshCw size={14} className="animate-spin" /> Salvando…</>
               :           <><Save size={14} /> Salvar</>}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-5">

              {/* ─── Nome de exibição ─── */}
              <Section icon={Tag} title="Nome de exibição">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                    Nome exibido no ERP e na loja B2B
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => { setDisplayName(e.target.value); setDirty(true); setSaved(false) }}
                    placeholder={tenantInfo?.name ?? 'Ex: Fast Malhas Confecções'}
                    maxLength={120}
                    className="w-full h-9 px-3 rounded-lg text-sm bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Aparece no canto superior esquerdo do ERP e no cabeçalho/rodapé da loja.
                    A URL permanece <code className="text-xs bg-[var(--color-bg-subtle)] px-1 rounded">{tenantInfo?.slug ?? '…'}.aurabr.app</code>
                  </p>
                </div>
              </Section>

              {/* ─── Logo ─── */}
              <Section icon={Upload} title="Logo da empresa">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-[var(--color-border)] flex items-center justify-center overflow-hidden bg-[var(--color-bg-subtle)] shrink-0 cursor-pointer hover:border-[var(--color-primary)] transition-colors" onClick={() => logoInputRef.current?.click()}>
                    {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" /> : <Upload size={20} className="text-[var(--color-text-disabled)]" />}
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-sm text-[var(--color-text-muted)] mb-2">PNG ou SVG transparente. Recomendado: 200×60px.</p>
                    <div className="flex gap-2">
                      <button onClick={() => logoInputRef.current?.click()} className="h-9 px-4 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors">
                        {logoUrl ? 'Trocar logo' : 'Enviar logo'}
                      </button>
                      {logoUrl && (
                        <button onClick={() => { setLogoUrl(null); setDirty(true) }} className="h-9 px-3 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-red-500 hover:border-red-300 transition-colors">
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
                <div className="flex flex-wrap gap-2 mb-4">
                  {COLOR_PRESETS.map(color => (
                    <button key={color} onClick={() => update('primaryColor', color)} title={color}
                      className="relative w-9 h-9 rounded-xl border-2 transition-all duration-150 hover:scale-110"
                      style={{ backgroundColor: color, borderColor: form.primaryColor === color ? 'var(--color-text)' : 'transparent' }}>
                      {form.primaryColor === color && <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow" />}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.primaryColor} onChange={e => update('primaryColor', e.target.value)}
                    className="w-11 h-11 rounded-xl border border-[var(--color-border)] cursor-pointer p-0.5 bg-[var(--color-bg)]" />
                  <div className="flex-1">
                    <input type="text" value={form.primaryColor}
                      onChange={e => { const v = e.target.value; if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) update('primaryColor', v) }}
                      placeholder="#0284C7"
                      className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">Qualquer cor hex válida</p>
                  </div>
                  <div className="w-11 h-11 rounded-xl shrink-0 border border-[var(--color-border)]" style={{ backgroundColor: form.primaryColor }} />
                </div>
              </Section>

              {/* ─── Mood ─── */}
              <Section icon={Palette} title="Estilo de superfície (mood)">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {MOOD_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => update('mood', opt.value)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-all duration-150 ${form.mood === opt.value ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-blue-950' : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'}`}>
                      <span className="text-2xl">{opt.emoji}</span>
                      <div>
                        <p className={`text-xs font-semibold ${form.mood === opt.value ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>{opt.label}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 leading-tight">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </Section>

              {/* ─── Tipografia ─── */}
              <Section icon={Type} title="Tipografia">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FONT_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => update('fontPair', opt.value)}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-150 ${form.fontPair === opt.value ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-blue-950' : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'}`}>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${form.fontPair === opt.value ? 'border-[var(--color-primary)] bg-[var(--color-primary)]' : 'border-[var(--color-border)]'}`}>
                        {form.fontPair === opt.value && <Check size={10} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${form.fontPair === opt.value ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>{opt.label}</p>
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
                    <button key={opt.value} onClick={() => update('radius', opt.value)}
                      className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-150 ${form.radius === opt.value ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-blue-950' : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'}`}>
                      <div className="w-12 h-12 border-2 shrink-0" style={{ borderRadius: opt.example, borderColor: form.radius === opt.value ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: form.radius === opt.value ? 'var(--color-primary)' : 'var(--color-bg-subtle)', opacity: form.radius === opt.value ? 0.2 : 1 }} />
                      <div className="text-center">
                        <p className={`text-xs font-semibold ${form.radius === opt.value ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>{opt.label}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 leading-tight">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </Section>

              {/* ─── Analytics ─── */}
              <Section icon={BarChart2} title="Analytics & Pixels">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">GA4 Measurement ID</label>
                    <input type="text" placeholder="G-XXXXXXXXXX" value={form.ga4MeasurementId ?? ''}
                      onChange={e => update('ga4MeasurementId', e.target.value.trim())}
                      className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">GA4 → Admin → Fluxos de dados. Injetado na loja e no ERP.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Meta Pixel ID</label>
                    <input type="text" placeholder="123456789012345" value={form.metaPixelId ?? ''}
                      onChange={e => update('metaPixelId', e.target.value.trim().replace(/\D/g, ''))}
                      className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">Gerenciador de Eventos → Pixels. Injetado apenas na loja.</p>
                  </div>
                  {(form.ga4MeasurementId || form.metaPixelId) && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 text-xs text-green-400 flex items-center gap-2">
                      <Check size={12} /> Scripts injetados após salvar. Cache leva até 60s para atualizar.
                    </div>
                  )}
                </div>
              </Section>

            </div>

            {/* ── Preview ── */}
            <div className="lg:col-span-1">
              <div className="sticky top-20 space-y-3">
                <Card className="p-5">
                  <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-4">Preview em tempo real</p>
                  <PreviewCard theme={form} logoUrl={logoUrl} displayName={displayName} />
                  <div className="mt-4 space-y-1.5">
                    {[
                      { label: 'Nome',         value: displayName || tenantInfo?.name || '—' },
                      { label: 'Cor primária', value: form.primaryColor },
                      { label: 'Mood',         value: MOOD_OPTIONS.find(m => m.value === form.mood)?.label },
                      { label: 'Tipografia',   value: FONT_OPTIONS.find(f => f.value === form.fontPair)?.label },
                      { label: 'Cantos',       value: RADIUS_OPTIONS.find(r => r.value === form.radius)?.label },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-[var(--color-text-muted)]">{row.label}</span>
                        <div className="flex items-center gap-1.5">
                          {row.label === 'Cor primária' && <div className="w-3 h-3 rounded-full border border-[var(--color-border)]" style={{ backgroundColor: form.primaryColor }} />}
                          <span className="font-medium text-[var(--color-text)] truncate max-w-[100px]">{row.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
                <p className="text-xs text-[var(--color-text-muted)] text-center px-2">Preview em tempo real. Clique em "Salvar" para persistir.</p>
              </div>
            </div>
          </div>

          {/* Botão mobile fixo */}
          {dirty && (
            <div className="fixed bottom-20 md:bottom-6 right-4 z-30 lg:hidden">
              <button onClick={handleSaveTheme} disabled={saving}
                className="flex items-center gap-2 h-11 px-5 rounded-full shadow-lg text-sm font-semibold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60 transition-colors">
                {saving ? <><RefreshCw size={14} className="animate-spin" /> Salvando…</> : <><Save size={14} /> Salvar</>}
              </button>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════
          ABA LOJA
      ══════════════════════════════════════════════ */}
      {activeTab === 'loja' && (
        <div className="max-w-xl space-y-5">
          <Section icon={Store} title="Loja B2B">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">Loja habilitada</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Quando desabilitada, a loja fica inacessível para compradores.
                    O ERP continua funcionando normalmente.
                  </p>
                </div>
                <button
                  onClick={() => setStoreEnabled(prev => !prev)}
                  className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${storeEnabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border-strong)]'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${storeEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${storeEnabled ? 'bg-green-500/10 border border-green-500/20 text-green-500' : 'bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text-muted)]'}`}>
                {storeEnabled
                  ? <><Check size={14} /> Loja acessível em <code className="text-xs font-mono">loja.{tenantInfo?.slug ?? '…'}.aurabr.app</code></>
                  : <><AlertCircle size={14} /> Loja desabilitada — compradores não conseguem acessar</>
                }
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveLoja} disabled={lojaSaving}>
                  {lojaSaved   ? <><Check size={14} /> Salvo!</>
                   : lojaSaving ? <><RefreshCw size={14} className="animate-spin" /> Salvando…</>
                   :              <><Save size={14} /> Salvar</>}
                </Button>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          ABA WHATSAPP
      ══════════════════════════════════════════════ */}
      {activeTab === 'whatsapp' && (
        <div className="max-w-xl space-y-5">

          {/* Info: config geral fica no master */}
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 flex items-start gap-3 text-sm">
            <AlertCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <div className="text-[var(--color-text)]">
              <p className="font-medium mb-1">Configuração técnica gerenciada pela Aura</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                A instância de WhatsApp deste tenant é provisionada e mantida pela equipe Aura.
                Aqui você gerencia apenas a conexão (escanear QR Code, reconectar) e o aprovador de pedidos.
              </p>
            </div>
          </div>

          {/* Status da conexão */}
          <Section icon={MessageCircle} title="Conexão WhatsApp">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {wppLoading
                    ? <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5"><RefreshCw size={12} className="animate-spin" /> Verificando…</span>
                    : wppStatus ? <WppStatusBadge status={wppStatus.status} /> : <WppStatusBadge status="STOPPED" />
                  }
                  {wppStatus?.phone && (
                    <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                      <Phone size={11} /> {wppStatus.phone}
                      {wppStatus.name && <> · {wppStatus.name}</>}
                    </span>
                  )}
                </div>
                <button onClick={loadWppStatus} disabled={wppLoading}
                  className="h-8 w-8 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors disabled:opacity-40">
                  <RefreshCw size={13} className={wppLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Feedback de conexão bem-sucedida */}
              {wppConnected && (
                <div className="rounded-xl border border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-700 p-3 flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                  <Check size={15} className="shrink-0" /> WhatsApp conectado com sucesso!
                </div>
              )}

              {/* QR Code */}
              {wppQr && (
                <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-white border border-[var(--color-border)]">
                  <p className="text-xs text-gray-500">Escaneie com o WhatsApp no celular</p>
                  <img src={wppQr} alt="QR Code WhatsApp" className="w-48 h-48 object-contain" />
                  <p className="text-xs text-gray-400 flex items-center gap-1.5 animate-pulse">
                    <RefreshCw size={11} className="animate-spin" /> Aguardando leitura…
                  </p>
                </div>
              )}

              {/* Erro */}
              {wppError && (
                <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 p-3 flex items-start gap-2 text-sm">
                  <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <span className="text-red-700 dark:text-red-400">{wppError}</span>
                </div>
              )}

              {/* Ações */}
              <div className="flex gap-2 flex-wrap">
                {(!wppStatus || wppStatus.status === 'STOPPED' || wppStatus.status === 'FAILED') && (
                  <button onClick={handleConnectWpp} disabled={wppActing}
                    className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors">
                    {wppActing ? <><RefreshCw size={13} className="animate-spin" /> Conectando…</> : <><Wifi size={13} /> Conectar</>}
                  </button>
                )}
                {wppStatus?.status === 'WORKING' && (
                  <button onClick={handleDisconnectWpp} disabled={wppActing}
                    className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium border border-red-300 text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors">
                    {wppActing ? <><RefreshCw size={13} className="animate-spin" /> Desconectando…</> : <><WifiOff size={13} /> Desconectar</>}
                  </button>
                )}
                {wppStatus?.status === 'SCAN_QR_CODE' && !wppQr && (
                  <button onClick={async () => {
                    const r = await fetch('/api/whatsapp/qr', { credentials: 'include' })
                    if (r.ok) { const { qr } = await r.json(); setWppQr(qr) }
                  }} className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors">
                    <QrCode size={13} /> Ver QR Code
                  </button>
                )}
              </div>
            </div>
          </Section>

          {/* Aprovador de pedidos */}
          <Section icon={Phone} title="Aprovador de pedidos WhatsApp">
            <div className="space-y-3">
              <p className="text-xs text-[var(--color-text-muted)]">
                Telefone que recebe notificação de cada novo pedido criado pelo agente IA e pode aprovar diretamente pelo WhatsApp.
              </p>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">WhatsApp do aprovador</label>
                <input
                  type="text"
                  placeholder="5511999999999 (com DDI, apenas dígitos)"
                  value={approverPhone}
                  onChange={e => { setApproverPhone(e.target.value); setApproverDirty(true); setApproverSaved(false) }}
                  className="w-full h-9 px-3 rounded-lg text-sm font-mono bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Mínimo 10 dígitos. Deixe vazio para desabilitar aprovação por WhatsApp.
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleSaveApprover}
                  disabled={approverSaving || (!approverDirty && !approverSaved)}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
                >
                  {approverSaved   ? <><Check size={13} /> Salvo!</>
                   : approverSaving ? <><RefreshCw size={13} className="animate-spin" /> Salvando…</>
                   :                  'Salvar'}
                </button>
              </div>
            </div>
          </Section>

          {/* Envio avulso */}
          <Section icon={Send} title="Envio avulso">
            <div className="space-y-3">
              <p className="text-xs text-[var(--color-text-muted)]">
                Envie uma mensagem manual para qualquer número, fora do fluxo do agente IA.
              </p>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Destinatário</label>
                <PhoneInput value={sendTo} onChange={setSendTo} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Mensagem</label>
                <textarea
                  rows={3}
                  placeholder="Digite a mensagem…"
                  value={sendMsg}
                  onChange={e => setSendMsg(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              {sendStatus === 'ok' && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <Check size={12} /> Mensagem enviada com sucesso!
                </p>
              )}
              {sendStatus?.startsWith('error') && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {sendStatus.replace('error:', '')}
                </p>
              )}
              <div className="flex justify-end">
                <button
                  onClick={handleManualSend}
                  disabled={sendSending || !sendTo || !sendMsg.trim()}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
                >
                  {sendSending
                    ? <><RefreshCw size={13} className="animate-spin" /> Enviando…</>
                    : <><Send size={13} /> Enviar</>}
                </button>
              </div>
            </div>
          </Section>

          {/* Como funciona */}
          <Section icon={MessageCircle} title="Como funciona">
            <div className="space-y-2 text-sm text-[var(--color-text-muted)]">
              <p>
                Quando um cliente envia mensagem para o seu WhatsApp, um agente IA atende automaticamente,
                consulta o catálogo e cria pedidos pendentes de aprovação.
              </p>
              <p>
                O usuário <strong>aprovador</strong> (configurado pela Aura) recebe notificação de cada pedido
                e pode aprovar respondendo <code className="text-xs bg-[var(--color-bg-subtle)] px-1 rounded">APROVAR &lt;numero&gt;</code>
                ou pela tela <strong>WhatsApp</strong> do ERP.
              </p>
              <p>
                Após aprovação, o cliente é notificado automaticamente em cada mudança de status do pedido
                (em produção, separação, enviado, entregue).
              </p>
            </div>
          </Section>

        </div>
      )}

      {/* ══════════════════════════════════════════════
          ABA PEDIDOS
      ══════════════════════════════════════════════ */}
      {activeTab === 'pedidos' && (
        <div className="max-w-xl space-y-5">
          <Section icon={ShoppingBag} title="Novo pedido — exibição de SKUs">
            <div className="space-y-4">
              <p className="text-sm text-[var(--color-text-muted)]">
                Escolha como os SKUs com variações (Cor × Tamanho) aparecem ao criar um pedido.
                Produtos sem grade mantêm sempre a lista.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    value: 'list',
                    icon: LayoutList,
                    label: 'Lista',
                    desc: 'Uma linha por SKU com estoque e stepper',
                  },
                  {
                    value: 'matrix',
                    icon: LayoutGrid,
                    label: 'Grade',
                    desc: 'Tabela Cor × Tamanho, compacta para muitos SKUs',
                  },
                ].map(opt => {
                  const Icon   = opt.icon
                  const active = (() => { try { return (localStorage.getItem('aura_order_view') ?? 'list') === opt.value } catch { return opt.value === 'list' } })()
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        try { localStorage.setItem('aura_order_view', opt.value) } catch {}
                        // força re-render do botão
                        setSaved(s => { setTimeout(() => setSaved(s), 0); return s })
                      }}
                      className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 text-center transition-all duration-150 ${
                        active
                          ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-blue-950'
                          : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
                      }`}
                    >
                      <Icon size={22} className={active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'} />
                      <div>
                        <p className={`text-xs font-semibold ${active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                          {opt.label}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 leading-tight">
                          {opt.desc}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                Preferência salva neste navegador. O ícone ⊞ no modal de pedido também permite trocar na hora.
              </p>
            </div>
          </Section>
        </div>
      )}

    </div>
  )
}
