/**
 * components/CategoryDefManager.jsx
 * Gestão de categorias de produto (CRUD simples)
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Check, X, RefreshCw, Tag } from 'lucide-react'

function authH() {
  const t = window.__aura_mem_token__ || ''
  return t ? { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }
           : { 'Content-Type': 'application/json' }
}
async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { credentials: 'include', headers: authH(), ...opts })
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Erro') }
  return res.json()
}

export let _categoryCacheInvalidate = null

function CatRow({ cat, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [name,    setName]    = useState(cat.name)
  const [saving,  setSaving]  = useState(false)

  const commit = async () => {
    if (!name.trim() || name === cat.name) { setEditing(false); return }
    setSaving(true)
    try { await onSave(cat.id, name.trim()); setEditing(false) }
    finally { setSaving(false) }
  }

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] last:border-0">
      {editing ? (
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter') commit(); if (e.key==='Escape') { setName(cat.name); setEditing(false) } }}
          className="flex-1 h-8 px-2 rounded-lg text-sm bg-[var(--color-bg)] border border-[var(--color-primary)] text-[var(--color-text)] focus:outline-none"
          autoFocus
        />
      ) : (
        <span className="flex-1 text-sm font-medium text-[var(--color-text)]">{cat.name}</span>
      )}
      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <button onClick={commit} disabled={saving} className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--color-primary)] text-white disabled:opacity-40">
            {saving ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
          </button>
        ) : (
          <button onClick={() => setEditing(true)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]">
            <Pencil size={13} />
          </button>
        )}
        <button onClick={() => onDelete(cat.id, cat.name)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

export function CategoryDefManager() {
  const [cats,    setCats]    = useState([])
  const [loading, setLoading] = useState(true)
  const [adding,  setAdding]  = useState(false)
  const [newName, setNewName] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [del,     setDel]     = useState(null)
  const [error,   setError]   = useState('')

  const fetchCats = useCallback(async () => {
    setLoading(true)
    try { const d = await apiFetch('/api/product-categories'); setCats(d.categories ?? []) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchCats() }, [fetchCats])
  // expor invalidação pro ProductForm
  useEffect(() => { _categoryCacheInvalidate = fetchCats }, [fetchCats])

  const create = async () => {
    const n = newName.trim(); if (!n) return
    setSaving(true)
    try { await apiFetch('/api/product-categories', { method:'POST', body: JSON.stringify({ name: n, sort_order: cats.length }) }); setNewName(''); setAdding(false); await fetchCats() }
    catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const update = async (id, name) => {
    await apiFetch(`/api/product-categories/${id}`, { method:'PUT', body: JSON.stringify({ name }) })
    await fetchCats()
  }

  const confirmDel = async () => {
    if (!del) return
    try { await apiFetch(`/api/product-categories/${del.id}`, { method:'DELETE' }); setDel(null); await fetchCats() }
    catch (e) { setError(e.message) }
  }

  if (loading) return <div className="flex justify-center py-20"><RefreshCw size={24} className="animate-spin text-[var(--color-primary)]" /></div>

  return (
    <div className="space-y-4 max-w-md">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-muted)]">Categorias disponíveis para classificar os produtos.</p>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 shrink-0">
          <Plus size={14} /> Nova categoria
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 text-sm text-red-700 flex justify-between">
          {error}<button onClick={() => setError('')}><X size={14}/></button>
        </div>
      )}

      {adding && (
        <div className="flex gap-2 p-3 rounded-xl border-2 border-dashed border-[var(--color-primary)]/40 bg-[var(--color-primary)]/4">
          <input
            type="text" placeholder="Nome da categoria…" value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter') create(); if (e.key==='Escape') setAdding(false) }}
            className="flex-1 h-9 px-3 rounded-lg text-sm bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            autoFocus
          />
          <button onClick={create} disabled={!newName.trim()||saving} className="h-9 px-4 rounded-lg text-sm font-semibold bg-[var(--color-primary)] text-white disabled:opacity-40">
            {saving ? <RefreshCw size={13} className="animate-spin"/> : 'Criar'}
          </button>
          <button onClick={() => { setAdding(false); setNewName('') }} className="h-9 px-3 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"><X size={14}/></button>
        </div>
      )}

      {cats.length === 0 && !adding ? (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface)] flex items-center justify-center"><Tag size={24} className="text-[var(--color-text-disabled)]" /></div>
          <p className="text-sm font-semibold text-[var(--color-text)]">Nenhuma categoria cadastrada</p>
          <button onClick={() => setAdding(true)} className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold bg-[var(--color-primary)] text-white hover:opacity-90"><Plus size={14}/>Criar primeira</button>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden">
          {cats.map(cat => <CatRow key={cat.id} cat={cat} onSave={update} onDelete={(id,name) => setDel({id,name})} />)}
        </div>
      )}

      {del && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[var(--color-bg)] rounded-2xl shadow-2xl p-6 space-y-4">
            <p className="text-sm text-[var(--color-text)]">Remover categoria <strong>{del.name}</strong>? Produtos que usam esta categoria não são afetados.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDel(null)} className="h-9 px-4 rounded-xl text-sm border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)]">Cancelar</button>
              <button onClick={confirmDel} className="h-9 px-4 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600">Remover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
