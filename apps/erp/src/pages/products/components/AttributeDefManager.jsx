/**
 * pages/products/components/AttributeDefManager.jsx
 *
 * Tela de gestão do domínio de atributos da grade.
 * Permite criar, editar e remover atributos e seus valores (com sigla editável).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, X, Pencil, Check, Trash2, GripVertical, RefreshCw, Tag } from 'lucide-react'
import { generateValueSlug } from '../productsTypes.js'
import { invalidateDefsCache } from './AttributeBuilder.jsx'

/* ── Fetch helpers ── */
function authHeaders() {
  const token = window.__aura_mem_token__ || ''
  return token
    ? { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
    : { 'Content-Type': 'application/json' }
}

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { credentials: 'include', headers: authHeaders(), ...opts })
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Erro') }
  return res.json()
}

/* ── Chip de valor com sigla editável ── */
function ValueChip({ val, onRemove, onSlugChange }) {
  const [editingSlug, setEditingSlug] = useState(false)
  const [slug, setSlug] = useState(val.slug)
  const inputRef = useRef()

  const commitSlug = () => {
    setEditingSlug(false)
    const s = slug.trim().toUpperCase().slice(0, 5)
    setSlug(s)
    onSlugChange(val.label, s || generateValueSlug(val.label))
  }

  return (
    <span className="
      inline-flex items-center gap-1.5 px-2.5 py-1
      rounded-full text-xs font-medium
      bg-[var(--color-surface)] border border-[var(--color-border)]
      text-[var(--color-text)]
    ">
      {val.label}
      {/* sigla */}
      {editingSlug ? (
        <span className="flex items-center gap-0.5">
          <input
            ref={inputRef}
            value={slug}
            onChange={e => setSlug(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter') commitSlug(); if (e.key === 'Escape') setEditingSlug(false) }}
            onBlur={commitSlug}
            className="w-10 h-5 px-1 text-xs rounded bg-[var(--color-bg)] border border-[var(--color-primary)] focus:outline-none text-center"
            maxLength={5}
            autoFocus
          />
        </span>
      ) : (
        <button
          type="button"
          onClick={() => { setEditingSlug(true); setTimeout(() => inputRef.current?.select(), 30) }}
          title="Editar sigla"
          className="
            inline-flex items-center gap-0.5
            text-[0.65rem] font-bold px-1 py-0.5 rounded
            bg-[var(--color-primary)]/10 text-[var(--color-primary)]
            hover:bg-[var(--color-primary)]/20 transition-colors
          "
        >
          <Tag size={9} />
          {slug || generateValueSlug(val.label)}
        </button>
      )}
      <button
        type="button"
        onClick={() => onRemove(val.label)}
        className="text-[var(--color-text-muted)] hover:text-red-500 transition-colors ml-0.5"
      >
        <X size={10} />
      </button>
    </span>
  )
}

/* ── Card de um atributo ── */
function AttrCard({ def, onUpdate, onDelete }) {
  const [editing,    setEditing]    = useState(false)
  const [name,       setName]       = useState(def.name)
  const [values,     setValues]     = useState(def.values ?? [])
  const [newVal,     setNewVal]     = useState('')
  const [saving,     setSaving]     = useState(false)
  const [showNewVal, setShowNewVal] = useState(false)
  const newValRef = useRef()

  /* Sincroniza se def mudar externamente */
  useEffect(() => { setName(def.name); setValues(def.values ?? []) }, [def])

  const isDirty = name !== def.name || JSON.stringify(values) !== JSON.stringify(def.values ?? [])

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onUpdate(def.id, { name: name.trim(), values })
      setEditing(false)
    } finally { setSaving(false) }
  }

  const addValue = () => {
    const label = newVal.trim()
    if (!label || values.some(v => v.label === label)) return
    setValues(prev => [...prev, { label, slug: generateValueSlug(label) }])
    setNewVal('')
    newValRef.current?.focus()
  }

  const removeValue = (label) => setValues(prev => prev.filter(v => v.label !== label))

  const changeSlug = (label, newSlug) => {
    setValues(prev => prev.map(v => v.label === label ? { ...v, slug: newSlug } : v))
  }

  const handleNewValKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addValue() }
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <GripVertical size={14} className="text-[var(--color-text-disabled)] shrink-0" />
        {editing ? (
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            className="
              flex-1 h-8 px-2 rounded-lg text-sm font-semibold
              bg-[var(--color-bg)] border border-[var(--color-primary)]
              text-[var(--color-text)] focus:outline-none
            "
            autoFocus
          />
        ) : (
          <span className="flex-1 text-sm font-semibold text-[var(--color-text)]">{def.name}</span>
        )}
        <span className="text-xs text-[var(--color-text-muted)] shrink-0">{values.length} valor{values.length !== 1 ? 'es' : ''}</span>
        {/* ações */}
        <div className="flex items-center gap-1 shrink-0">
          {editing && isDirty ? (
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-40"
            >
              {saving ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
              Salvar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(v => !v)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
            >
              <Pencil size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(def.id, def.name)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Valores */}
      <div className="p-4 space-y-3">
        {values.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {values.map(v => (
              <ValueChip
                key={v.label}
                val={v}
                onRemove={removeValue}
                onSlugChange={changeSlug}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-disabled)] italic">Nenhum valor cadastrado</p>
        )}

        {/* Adicionar valor */}
        {showNewVal ? (
          <div className="flex gap-2">
            <input
              ref={newValRef}
              type="text"
              placeholder="Novo valor…"
              value={newVal}
              onChange={e => setNewVal(e.target.value)}
              onKeyDown={handleNewValKey}
              onBlur={() => { if (!newVal.trim()) setShowNewVal(false) }}
              className="
                flex-1 h-8 px-3 rounded-lg text-sm
                bg-[var(--color-bg-subtle)] border border-[var(--color-border)]
                text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)]
                focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
              "
              autoFocus
            />
            <button
              type="button"
              onClick={addValue}
              disabled={!newVal.trim()}
              className="h-8 px-3 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white disabled:opacity-40 hover:opacity-90"
            >
              <Plus size={13} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setShowNewVal(true); setEditing(true) }}
            className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            <Plus size={12} /> Adicionar valor
          </button>
        )}

        {/* Aviso de save pendente */}
        {isDirty && !editing && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <span className="text-xs text-amber-700 dark:text-amber-400">Há alterações não salvas</span>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
            >
              Salvar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Componente principal ── */
export function AttributeDefManager() {
  const [defs,       setDefs]       = useState([])
  const [isLoading,  setIsLoading]  = useState(true)
  const [newAttrName, setNewAttrName] = useState('')
  const [adding,     setAdding]     = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)  // { id, name }
  const [error, setError] = useState('')

  const fetchDefs = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await apiFetch('/api/product-attributes')
      setDefs(data.attributes ?? [])
    } catch (e) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchDefs() }, [fetchDefs])

  const createAttr = async () => {
    const name = newAttrName.trim()
    if (!name) return
    setSaving(true)
    try {
      await apiFetch('/api/product-attributes', {
        method: 'POST',
        body: JSON.stringify({ name, values: [], sort_order: defs.length }),
      })
      invalidateDefsCache()
      setNewAttrName('')
      setAdding(false)
      await fetchDefs()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false) }
  }

  const updateAttr = useCallback(async (id, data) => {
    await apiFetch(`/api/product-attributes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    invalidateDefsCache()
    await fetchDefs()
  }, [fetchDefs])

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await apiFetch(`/api/product-attributes/${deleteTarget.id}`, { method: 'DELETE' })
      invalidateDefsCache()
      setDeleteTarget(null)
      await fetchDefs()
    } catch (e) {
      setError(e.message)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-[var(--color-primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-2xl">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--color-text-muted)]">
            Defina os atributos e valores disponíveis para montagem da grade de produtos.<br />
            A sigla <span className="font-semibold text-[var(--color-primary)]">PT</span> é usada no código do SKU e pode ser editada clicando nela.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="shrink-0 flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> Novo atributo
        </button>
      </div>

      {/* Erro */}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300 flex items-center justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      {/* Formulário novo atributo */}
      {adding && (
        <div className="rounded-2xl border-2 border-dashed border-[var(--color-primary)]/40 bg-[var(--color-primary)]/4 p-4 space-y-3">
          <p className="text-sm font-semibold text-[var(--color-text)]">Novo atributo</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ex: Tamanho Letras, Cor, Material…"
              value={newAttrName}
              onChange={e => setNewAttrName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createAttr(); if (e.key === 'Escape') setAdding(false) }}
              className="
                flex-1 h-9 px-3 rounded-lg text-sm
                bg-[var(--color-bg)] border border-[var(--color-border)]
                text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)]
                focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
              "
              autoFocus
            />
            <button
              type="button"
              onClick={createAttr}
              disabled={!newAttrName.trim() || saving}
              className="h-9 px-4 rounded-lg text-sm font-semibold bg-[var(--color-primary)] text-white disabled:opacity-40 hover:opacity-90"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : 'Criar'}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setNewAttrName('') }}
              className="h-9 px-3 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Lista de atributos */}
      {defs.length === 0 && !adding ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface)] flex items-center justify-center">
            <Tag size={24} className="text-[var(--color-text-disabled)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--color-text)]">Nenhum atributo cadastrado</p>
          <p className="text-xs text-[var(--color-text-muted)]">Crie atributos para usar na grade de produtos.</p>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold bg-[var(--color-primary)] text-white hover:opacity-90"
          >
            <Plus size={14} /> Criar primeiro atributo
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {defs.map(def => (
            <AttrCard
              key={def.id}
              def={def}
              onUpdate={updateAttr}
              onDelete={(id, name) => setDeleteTarget({ id, name })}
            />
          ))}
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[var(--color-bg)] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
              <Trash2 size={16} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">
                Remover o atributo <strong>{deleteTarget.name}</strong> do domínio.<br />
                Produtos já cadastrados não serão afetados.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="h-9 px-4 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)]"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="h-9 px-4 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
