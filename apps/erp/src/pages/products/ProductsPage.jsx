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

import React, { useState, useCallback, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Plus, Printer, Search, Filter, X, Package, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, Upload, Tag, Layers, LayoutGrid, List } from 'lucide-react'
import { Button, Input, Badge, Card, Skeleton, Modal } from '@aura/ui'
import { ProductCard }  from './components/ProductCard.jsx'
import { ProductForm }  from './components/ProductForm.jsx'
import { useProducts }  from './useProducts.js'
import { PRODUCT_TYPES, DEFAULT_CATEGORIES } from './productsTypes.js'
import { ImportModal } from './components/ImportModal.jsx'
import { AttributeDefManager } from './components/AttributeDefManager.jsx'
import { CategoryDefManager }  from './components/CategoryDefManager.jsx'

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


/* ─── List view row ─── */
function ProductListView({ products, onEdit, onDelete }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Produto</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">Código</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Categoria</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Tipo</th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">SKUs</th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Estoque</th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">Preço Atac.</th>
            <th className="px-3 py-2.5 text-center text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Ações</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => {
            const skus      = p.skus ?? []
            const stock     = skus.reduce((a, s) => a + (s.stock ?? s.estoque ?? 0), 0)
            const minPrice  = skus.length ? Math.min(...skus.map(s => parseFloat(s.priceWholesale ?? s.price_wholesale ?? 0) || 0).filter(v => v > 0)) : null
            const maxPrice  = skus.length ? Math.max(...skus.map(s => parseFloat(s.priceWholesale ?? s.price_wholesale ?? 0) || 0)) : null
            const isVariant = p.type === 'variant'
            const priceStr  = minPrice == null ? '—'
              : minPrice === maxPrice ? `R$ ${minPrice.toFixed(2).replace('.', ',')}`
              : `R$ ${minPrice.toFixed(2).replace('.', ',')} – ${maxPrice.toFixed(2).replace('.', ',')}`

            return (
              <tr key={p.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)] transition-colors">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {p.image ? (
                      <img src={p.image} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 border border-[var(--color-border)]" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-surface)] flex items-center justify-center shrink-0 border border-[var(--color-border)]">
                        <Package size={14} className="text-[var(--color-text-muted)]" />
                      </div>
                    )}
                    <span className="font-medium text-[var(--color-text)] truncate max-w-[200px]">{p.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-[var(--color-text-muted)] whitespace-nowrap">{p.code || '—'}</td>
                <td className="px-3 py-2 text-[var(--color-text-muted)] text-xs">{p.category || '—'}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isVariant ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'}`}>
                    {isVariant ? 'Grade' : 'Simples'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-[var(--color-text-muted)] text-xs">{skus.length}</td>
                <td className="px-3 py-2 text-right">
                  <span className={`text-xs font-semibold ${stock === 0 ? 'text-red-500' : stock < 10 ? 'text-amber-500' : 'text-green-600'}`}>{stock}</span>
                </td>
                <td className="px-3 py-2 text-right text-xs text-[var(--color-text-muted)] whitespace-nowrap">{priceStr}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => onEdit(p)} className="h-7 px-2.5 rounded-lg text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors">Editar</button>
                    <button onClick={() => onDelete(p)} className="h-7 px-2.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">Excluir</button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
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

  const location = useLocation()
  const [formOpen,       setFormOpen]       = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [showImport,    setShowImport]    = useState(false)
  const [deletingProduct, setDeletingProduct] = useState(null)
  const [showFilters,    setShowFilters]    = useState(false)
  const [viewMode,      setViewMode]      = useState(() => {
    try { return localStorage.getItem('aura_products_view') || 'grid' } catch { return 'grid' }
  })
  const handleViewMode = (mode) => {
    setViewMode(mode)
    try { localStorage.setItem('aura_products_view', mode) } catch {}
  }
  const [activeTab,     setActiveTab]     = useState('produtos')
  const [dbCategories,  setDbCategories]  = useState([])
  const [dbAttrDefs,    setDbAttrDefs]    = useState([])
  const [filterAttr,   setFilterAttr]    = useState('')
  const [filterAttrVal,setFilterAttrVal] = useState('')

  useEffect(() => {
    if (location.state?.openNew) { setEditingProduct(null); setFormOpen(true); window.history.replaceState({}, '') }
  }, []) // eslint-disable-line

  useEffect(() => {
    const token = window.__aura_mem_token__ || ''
    const h = token ? { Authorization: 'Bearer ' + token } : {}
    Promise.all([
      fetch('/api/product-categories', { credentials: 'include', headers: h }).then(r => r.json()).catch(() => ({ categories: [] })),
      fetch('/api/product-attributes',  { credentials: 'include', headers: h }).then(r => r.json()).catch(() => ({ attributes: [] })),
    ]).then(([catData, attrData]) => {
      setDbCategories(catData.categories ?? [])
      setDbAttrDefs(attrData.attributes ?? [])
    })
  }, [activeTab])

  const handlePrintProducts = () => {
    const allSkus = products.flatMap(p => (p.skus ?? []).map(s => ({
      ...s,
      productName: p.name,
      category: p.category,
      type: p.type,
    })))
    printList({
      title: 'Produtos e SKUs',
      columns: [
        { label: 'Produto',   key: 'productName' },
        { label: 'SKU',       key: 'code' },
        { label: 'Categoria', key: 'category' },
        { label: 'Estoque',   key: 'stock',    align: 'right' },
        { label: 'Mínimo',    key: 'stockMin', align: 'right' },
        { label: 'Preço',     get: s => `R$ ${Number(s.priceWholesale).toFixed(2)}`, align: 'right' },
      ],
      rows: allSkus,
      summary: [
        { label: 'Produtos', value: products.length },
        { label: 'SKUs',     value: allSkus.length },
        { label: 'Total estoque', value: allSkus.reduce((a, s) => a + (s.stock ?? 0), 0) },
      ],
    })
  }

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

  const clearFilters = () => { setFilters({ search: '', type: '', category: '' }); setFilterAttr(''); setFilterAttrVal('') }
  const hasActiveFilters = filters.search || filters.type || filters.category || filterAttr

  return (
    <div className="space-y-5 max-w-screen-xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">Produtos</h2>
          {activeTab === 'produtos' && !isLoading && (
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              {total} produto{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'produtos' && (<>
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
            <button onClick={handlePrintProducts} disabled={products.length === 0}
              className="flex items-center gap-2 h-9 px-3 text-sm font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] disabled:opacity-40 transition-colors">
              <Printer size={14} /> Imprimir
            </button>
            <Button onClick={openNew} size="sm">
              <Plus size={15} /> Novo produto
            </Button>
            {/* View toggle */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
              <button
                onClick={() => handleViewMode('grid')}
                className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${viewMode==='grid' ? 'bg-[var(--color-bg)] text-[var(--color-text)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                title="Visão em grade"
              ><LayoutGrid size={14} /></button>
              <button
                onClick={() => handleViewMode('list')}
                className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${viewMode==='list' ? 'bg-[var(--color-bg)] text-[var(--color-text)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                title="Visão em lista"
              ><List size={14} /></button>
            </div>
          </>)}
        </div>
      </div>

      {/* Tabs */}
      {/* filtro de atributo aplicado nos products */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--color-surface)] w-fit">
        {[
          { key: 'produtos',    label: 'Produtos',           Icon: Package },
          { key: 'categorias',  label: 'Categorias',         Icon: Layers },
          { key: 'atributos',   label: 'Atributos da Grade', Icon: Tag },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={[
              'flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium transition-all',
              activeTab === key
                ? 'bg-[var(--color-bg)] text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            ].join(' ')}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'categorias' && <CategoryDefManager />}
      {activeTab === 'atributos' && <AttributeDefManager />}

      {activeTab === 'produtos' && <>
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
            className="h-9 px-3 rounded-lg text-sm bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <option value="">Todas as categorias</option>
            {(dbCategories.length ? dbCategories : DEFAULT_CATEGORIES.map(n => ({ name: n }))).map(cat => (
              <option key={cat.name} value={cat.name}>{cat.name}</option>
            ))}
          </select>

          {/* Atributo */}
          {dbAttrDefs.length > 0 && (
            <select
              value={filterAttr}
              onChange={e => { setFilterAttr(e.target.value); setFilterAttrVal('') }}
              className="h-9 px-3 rounded-lg text-sm bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="">Todos os atributos</option>
              {dbAttrDefs.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
          )}
          {/* Valor do atributo */}
          {filterAttr && (
            <select
              value={filterAttrVal}
              onChange={e => setFilterAttrVal(e.target.value)}
              className="h-9 px-3 rounded-lg text-sm bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="">Todos os valores</option>
              {(dbAttrDefs.find(a => a.name === filterAttr)?.values ?? []).map(v => (
                <option key={v.label} value={v.label}>{v.label}</option>
              ))}
            </select>
          )}
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
          {viewMode === 'list' ? (
            <ProductListView
              products={products.filter(p => {
                if (!filterAttr) return true
                return (p.skus ?? []).some(s => {
                  const val = s.attributes?.[filterAttr]
                  if (!val) return false
                  return !filterAttrVal || val === filterAttrVal
                })
              })}
              onEdit={openEdit}
              onDelete={setDeletingProduct}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.filter(p => {
                if (!filterAttr) return true
                return (p.skus ?? []).some(s => {
                  const val = s.attributes?.[filterAttr]
                  if (!val) return false
                  return !filterAttrVal || val === filterAttrVal
                })
              }).map(p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onEdit={openEdit}
                  onDelete={setDeletingProduct}
                />
              ))}
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}

      </> }

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
