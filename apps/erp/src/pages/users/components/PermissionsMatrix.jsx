/**
 * pages/users/components/PermissionsMatrix.jsx
 *
 * T8 — Editor de perfis de acesso.
 * Permite ao admin configurar permissões por papel × módulo
 * e visibilidade de menus. Salvo em settings['access_permissions'].
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Check, Eye, Minus, Save, RefreshCw, Lock, Unlock } from 'lucide-react'
import { Card, Button } from '@aura/ui'
import { MODULE_PERMISSIONS, ROLE_LIST } from '../usersTypes.js'

const PERM_VALUES = ['total', 'leitura', '—']
const PERM_NEXT   = { 'total': 'leitura', 'leitura': '—', '—': 'total' }

function authFetch(url, opts = {}) {
  const tok = window.__aura_mem_token__ || ''
  return fetch(url, {
    ...opts,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(tok ? { Authorization: 'Bearer ' + tok } : {}),
      ...(opts.headers ?? {}),
    },
  })
}

/* ─── Célula de permissão ─── */
function PermCell({ value, editable, onChange }) {
  const style = {
    total:    { icon: <Check size={13} />,   cls: 'text-green-600 bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-700',  label: 'Total' },
    leitura:  { icon: <Eye size={13} />,     cls: 'text-amber-600 bg-amber-50  dark:bg-amber-950/40  border-amber-300  dark:border-amber-700',  label: 'Leitura' },
    '—':      { icon: <Minus size={13} />,   cls: 'text-[var(--color-text-disabled)] bg-transparent border-[var(--color-border)]',           label: 'Nenhum' },
  }
  const { icon, cls, label } = style[value] ?? style['—']

  if (!editable) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}>
        {icon}<span className="hidden sm:inline">{label}</span>
      </span>
    )
  }

  return (
    <button type="button" onClick={() => onChange(PERM_NEXT[value] ?? '—')} title={`Clique para trocar (${label})`}
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border transition-all hover:opacity-80 hover:scale-105 cursor-pointer ${cls}`}>
      {icon}<span className="hidden sm:inline">{label}</span>
    </button>
  )
}

/* ─── Célula de visibilidade de menu ─── */
function MenuCell({ visible, editable, onChange }) {
  if (!editable) return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${visible ? 'text-green-600' : 'text-[var(--color-text-disabled)]'}`}>
      {visible ? <><Unlock size={11} /> Sim</> : <><Lock size={11} /> Não</>}
    </span>
  )
  return (
    <button type="button" onClick={() => onChange(!visible)}
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border transition-all hover:opacity-80 cursor-pointer ${
        visible ? 'text-green-600 bg-green-50 dark:bg-green-950/40 border-green-300' : 'text-[var(--color-text-disabled)] bg-transparent border-[var(--color-border)]'
      }`}>
      {visible ? <><Unlock size={11} /> Sim</> : <><Lock size={11} /> Não</>}
    </button>
  )
}

/* ─── Componente principal ─── */
export function PermissionsMatrix() {
  const [editMode,    setEditMode]    = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [activeTab,   setActiveTab]   = useState('data')   // 'data' | 'menu'
  // custom[roleKey][moduleKey] = 'total'|'leitura'|'—'
  const [custom,      setCustom]      = useState({})
  // menuVis[roleKey][moduleKey] = true|false
  const [menuVis,     setMenuVis]     = useState({})

  /* ─── Inicializa com defaults da matriz estática ─── */
  const buildDefaults = useCallback(() => {
    const c = {}
    const m = {}
    ROLE_LIST.forEach(role => {
      c[role.key] = {}
      m[role.key] = {}
      MODULE_PERMISSIONS.forEach(mod => {
        c[role.key][mod.key] = mod.perms[role.key] ?? '—'
        m[role.key][mod.key] = (mod.perms[role.key] ?? '—') !== '—'
      })
    })
    return { c, m }
  }, [])

  /* ─── Carrega permissões salvas ─── */
  useEffect(() => {
    setLoading(true)
    authFetch('/api/tenant/permissions')
      .then(r => r.json())
      .then(d => {
        const { c, m } = buildDefaults()
        if (d.permissions?.data)    Object.assign(c, d.permissions.data)
        if (d.permissions?.menuVis) Object.assign(m, d.permissions.menuVis)
        setCustom(c); setMenuVis(m)
      })
      .catch(() => {
        const { c, m } = buildDefaults()
        setCustom(c); setMenuVis(m)
      })
      .finally(() => setLoading(false))
  }, [buildDefaults])

  function setCellPerm(roleKey, modKey, val) {
    setCustom(prev => ({ ...prev, [roleKey]: { ...(prev[roleKey] ?? {}), [modKey]: val } }))
  }

  function setCellMenu(roleKey, modKey, val) {
    setMenuVis(prev => ({ ...prev, [roleKey]: { ...(prev[roleKey] ?? {}), [modKey]: val } }))
  }

  async function handleSave() {
    setSaving(true); setSaved(false)
    try {
      await authFetch('/api/tenant/permissions', {
        method: 'PUT',
        body: JSON.stringify({ permissions: { data: custom, menuVis } }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
  }

  function handleReset() {
    const { c, m } = buildDefaults()
    setCustom(c); setMenuVis(m)
  }

  const grid = (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide min-w-[120px]">
              Módulo
            </th>
            {ROLE_LIST.map(role => (
              <th key={role.key} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                <span className={role.color}>{role.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {MODULE_PERMISSIONS.map(mod => (
            <tr key={mod.key} className="hover:bg-[var(--color-bg-subtle)] transition-colors">
              <td className="px-4 py-2.5 text-sm font-medium text-[var(--color-text)]">{mod.module}</td>
              {ROLE_LIST.map(role => {
                const isAdmin = role.key === 'admin'
                if (activeTab === 'data') {
                  const val = custom[role.key]?.[mod.key] ?? mod.perms[role.key] ?? '—'
                  return (
                    <td key={role.key} className="px-4 py-2.5 text-center">
                      <PermCell value={val} editable={editMode && !isAdmin}
                        onChange={v => setCellPerm(role.key, mod.key, v)} />
                    </td>
                  )
                } else {
                  const vis = menuVis[role.key]?.[mod.key] ?? ((mod.perms[role.key] ?? '—') !== '—')
                  return (
                    <td key={role.key} className="px-4 py-2.5 text-center">
                      <MenuCell visible={vis} editable={editMode && !isAdmin}
                        onChange={v => setCellMenu(role.key, mod.key, v)} />
                    </td>
                  )
                }
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text)]">Perfis de acesso</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {editMode ? 'Clique nas células para alterar. Admin sempre tem acesso total.' : 'Configure acessos e visibilidade de menus por papel.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editMode && (
            <>
              <button type="button" onClick={handleReset}
                className="text-xs px-2 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors">
                Restaurar padrões
              </button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <><RefreshCw size={13} className="animate-spin" /> Salvando…</>
                         : saved ? '✓ Salvo!'
                         : <><Save size={13} /> Salvar</>}
              </Button>
            </>
          )}
          <button type="button"
            onClick={() => setEditMode(e => !e)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium ${
              editMode
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]'
            }`}>
            {editMode ? 'Modo edição ativo' : 'Editar perfis'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        {[
          { key: 'data', label: 'Acesso a dados' },
          { key: 'menu', label: 'Visibilidade de menus' },
        ].map(t => (
          <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-[var(--color-primary)] text-white'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-sm text-[var(--color-text-muted)]">
          Carregando…
        </div>
      ) : grid}

      {editMode && (
        <p className="text-[11px] text-[var(--color-text-muted)] mt-3">
          💡 As alterações são aplicadas no próximo login dos usuários afetados.
          Admin sempre mantém acesso total (não editável).
        </p>
      )}
    </Card>
  )
}
