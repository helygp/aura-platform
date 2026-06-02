/**
 * pages/products/ProductsPage.jsx
 *
 * Página de listagem + gestão de produtos.
 *
 * Layout:
 *   - Header: título + botão Novo produto
 *   - Barra de filtros: busca, tipo, categoria
 *   - Grid de cards (1→2→3→4 colunas)
 *   - Paginação
 *   - Modal de formulário (criar/editar)
 *   - Modal de confirmação de exclusão
 *
 * Estados:
 *   - loading: skeleton grid
 *   - empty (sem filtros): ilustração + CTA
 *   - empty (com filtros): mensagem + limpar filtros
 */

import React, { useState, useCallback } from 'react'
import { Plus, Search, Filter, X, Package, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, Upload } from 'lucide-react'
import { Button, Input, Badge, Card, Skeleton, Modal } from '@aura/ui'
import { ProductCard }  from './components/ProductCard.jsx'
import { ProductForm }  from './components/ProductForm.jsx'
import { useProducts }  from './useProducts.js'
import { PRODUCT_TYPES, DEFAULT_CATEGORIES } from './productsTypes.js'
import { ImportModal } from './components/ImportModal.jsx'

/* ─── Skeleton grid ─── */
function ProductsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="rounded-xl border border-[var(--color-border)] overflow-hidden">
          <Skeleton width="100%" className="aspect-square" />
          <div className="p-3 space-y-2">
            <Skeleton width="60%" height={10} />
            <Skeleton width="90%" height={13} />
            <Skeleton width="40%" height={10} />
            <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
              <Skeleton width="50%" height={12} />
              <Skeleton width="30%" height={18} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Empty state ─── */
function EmptyState({ hasFilters, onClearFilters, onNew, onImport }) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <Search size={32} className="text-[var(--color-text-disabled)]" />
        <div>
          <p className="font-semibold text-[var(--color-text)]">Nenhum produto encontrado</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Tente outros filtros ou termos de busca.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onClearFilters}>
          <X size={14} /> Limpar filtros
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-20 h-20 rounded-2xl bg-[var(--color-surface)] flex items-center justify-center">
        <Package size={36} className="text-[var(--color-text-disabled)]" />
      </div>
      <div>
        <p className="font-semibold text-[var(--color-text)]">Nenhum produto cadastrado</p>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Comece criando seu primeiro produto.</p>
      </div>
      <button
        onClick={onImport}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
      >
        <Upload size={15} /> Importar planilha
      </button>
      <Button onClick={onNew}>
        <Plus size={15} /> Criar produto
      </Button>
    </div>
  )
}

/* ─── Modal de confirmação de exclusão ─── */
function DeleteConfirmModal({ product, onConfirm, onCancel }) {
  const [deleting, setDeleting] = useState(false)
  const handleConfirm = async () => {
    setDeleting(true)
    try { await onConfirm(product.id) } finally { setDeleting(false) }
  }
  return (
    <Modal open={Boolean(product)} onOpenChange={v => !v && onCancel()}>
      <Modal.Content title="Excluir produto" size="sm">
        <div className="py-2 space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
            <AlertTriangle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">
              Esta ação não pode ser desfeita. Todos os SKUs e histórico serão removidos.
            </p>
          </div>
          <p className="text-sm text-[var(--color-text)]">
            Tem certeza que deseja excluir <strong>{product?.name}</strong>?
          </p>
        </div>
        <Modal.Footer>
          <Button variant="secondary" onClick={onCancel} disabled={deleting}>Cancelar</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={deleting}>
            {deleting ? <><RefreshCw size={14} className="animate-spin" /> Excluindo…</> : 'Excluir'}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  )
}

/* ─── Paginação ─── */
function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <Button
        variant="ghost" size="sm"
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
      >
        <ChevronLeft size={16} />
      </Button>
      <span className="text-sm text-[var(--color-text-muted)] px-2">
        {page} / {totalPages}
      </span>
      <Button
        variant="ghost" size="sm"
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
      >
        <ChevronRight size={16} />
      </Button>
    </div>
  )
}

/* ─── Página ─── */
export function ProductsPage() {
  const {
    products, total, totalPages, isLoading,
    filters, setFilters, page, setPage,
    refetch, saveProduct, deleteProduct,
  } = useProducts()

  const [formOpen,       setFormOpen]       = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [showImport,    setShowImport]    = useState(false)
  const [deletingProduct, setDeletingProduct] = useState(null)
  const [showFilters,    setShowFilters]    = useState(false)

  const openNew  = () => { setEditingProduct(null); setFormOpen(true) }
  const openEdit = (p) => { setEditingProduct(p);   setFormOpen(true) }
  const closeForm = () => { setFormOpen(false); setEditingProduct(null) }

  const handleSave = useCallback(async (data) => {
    await saveProduct(data)
  }, [saveProduct])

  const handleDelete = useCallback(async (id) => {
    await deleteProduct(id)
    setDeletingProduct(null)
  }, [deleteProduct])

  const clearFilters = () => setFilters({ search: '', type: '', category: '' })
  const hasActiveFilters = filters.search || filters.type || filters.category

  return (
    <div className="space-y-5 max-w-screen-xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">Produtos</h2>
          {!isLoading && (
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              {total} produto{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refetch}
            disabled={isLoading}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] disabled:opacity-40 transition-colors"
            aria-label="Atualizar"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 h-9 px-3 text-sm font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
          >
            <Upload size={14} /> Importar
          </button>
          <Button onClick={openNew} size="sm">
            <Plus size={15} /> Novo produto
          </Button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <Card className="p-3">
        <div className="flex gap-2 flex-wrap">
          {/* Busca */}
          <div className="flex-1 min-w-[180px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nome ou código…"
              value={filters.search}
              onChange={e => setFilters({ search: e.target.value })}
              className="
                w-full h-9 pl-8 pr-3 rounded-lg text-sm
                bg-[var(--color-bg-subtle)] border border-[var(--color-border)]
                text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)]
                focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
                focus:bg-[var(--color-bg)]
              "
            />
          </div>

          {/* Tipo */}
          <select
            value={filters.type}
            onChange={e => setFilters({ type: e.target.value })}
            className="
              h-9 px-3 rounded-lg text-sm
              bg-[var(--color-bg-subtle)] border border-[var(--color-border)]
              text-[var(--color-text)]
              focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
            "
          >
            <option value="">Todos os tipos</option>
            <option value={PRODUCT_TYPES.SIMPLE}>Simples</option>
            <option value={PRODUCT_TYPES.VARIANT}>Com grade</option>
          </select>

          {/* Categoria */}
          <select
            value={filters.category}
            onChange={e => setFilters({ category: e.target.value })}
            className="
              h-9 px-3 rounded-lg text-sm
              bg-[var(--color-bg-subtle)] border border-[var(--color-border)]
              text-[var(--color-text)]
              focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
            "
          >
            <option value="">Todas as categorias</option>
            {DEFAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Limpar */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="
                h-9 px-3 rounded-lg text-sm font-medium
                text-[var(--color-text-muted)] hover:text-red-500
                hover:bg-red-50 dark:hover:bg-red-950
                transition-colors
              "
            >
              <X size={14} />
            </button>
          )}
        </div>
      </Card>

      {/* ── Grid ── */}
      {isLoading ? (
        <ProductsSkeleton />
      ) : products.length === 0 ? (
        <EmptyState
          hasFilters={Boolean(hasActiveFilters)}
          onClearFilters={clearFilters}
          onNew={openNew}
        
            onImport={() => setShowImport(true)}
          />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                onEdit={openEdit}
                onDelete={setDeletingProduct}
              />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}

      {/* ── Importação ── */}
      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={() => { setShowImport(false); refetch() }}
      />

      {/* ── Formulário ── */}
      <ProductForm
        open={formOpen}
        onClose={closeForm}
        product={editingProduct}
        onSave={handleSave}
      />

      {/* ── Confirmar exclusão ── */}
      <DeleteConfirmModal
        product={deletingProduct}
        onConfirm={handleDelete}
        onCancel={() => setDeletingProduct(null)}
      />
    </div>
  )
}
