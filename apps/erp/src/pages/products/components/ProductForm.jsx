/**
 * pages/products/components/ProductForm.jsx
 *
 * Drawer/Modal de cadastro e edição de produto.
 * Usa Modal do @aura/ui como base.
 *
 * Suporta dois fluxos:
 *   1. Produto simples — nome, código, categoria, foto, preço atacado, estoque mínimo
 *   2. Produto com grade — idem + AttributeBuilder + SkuGrid gerada automaticamente
 *
 * Props:
 *   open       : boolean
 *   onClose    : () => void
 *   product    : objeto a editar (null = novo)
 *   onSave     : (data) => Promise<void>
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, X, RefreshCw, Info } from 'lucide-react'
import { Modal, Button, Input, Badge } from '@aura/ui'
import { AttributeBuilder } from './AttributeBuilder.jsx'
import { SkuGrid }          from './SkuGrid.jsx'
import {
  PRODUCT_TYPES,
  DEFAULT_CATEGORIES,
  generateSkus,
  validateSimpleProduct,
  validateVariantProduct,
} from '../productsTypes.js'

/* ─── Foto upload (preview local) ─── */
function ImageUpload({ imageUrl, onImageChange }) {
  const inputRef = useRef(null)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onImageChange(reader.result)
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <p className="text-sm font-medium text-[var(--color-text)] mb-1.5">Foto do produto</p>
      <div
        onClick={() => inputRef.current?.click()}
        className="
          relative w-full aspect-video max-w-[200px] rounded-xl overflow-hidden
          border-2 border-dashed border-[var(--color-border)]
          bg-[var(--color-bg-subtle)] cursor-pointer
          hover:border-[var(--color-primary)] hover:bg-[var(--color-surface)]
          transition-colors duration-150 flex items-center justify-center
        "
      >
        {imageUrl ? (
          <>
            <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onImageChange(null) }}
              className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80"
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-[var(--color-text-muted)]">
            <Upload size={20} />
            <span className="text-xs">Clique para enviar</span>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  )
}

/* ─── Form state inicial ─── */
function initialForm(product) {
  if (!product) return {
    name: '', code: '', category: '', type: PRODUCT_TYPES.SIMPLE,
    imageUrl: null, priceWholesale: '', stockMin: '0',
    attributes: [], skus: [],
  }
  return {
    ...product,
    priceWholesale: product.skus?.[0]?.priceWholesale ?? '',
    stockMin:       product.skus?.[0]?.stockMin ?? '0',
  }
}

export function ProductForm({ open, onClose, product, onSave }) {
  const isEdit = Boolean(product?.id)
  const [form,    setForm]    = useState(() => initialForm(product))
  const [errors,  setErrors]  = useState({})
  const [saving,  setSaving]  = useState(false)
  const [skus,    setSkus]    = useState(product?.skus ?? [])

  /* Reseta ao abrir/trocar produto */
  useEffect(() => {
    if (open) {
      setForm(initialForm(product))
      setSkus(product?.skus ?? [])
      setErrors({})
    }
  }, [open, product])

  const set = (field) => (e) =>
    setForm(prev => ({ ...prev, [field]: e.target?.value ?? e }))

  /* Regenera SKUs ao mudar atributos */
  const handleAttributeChange = useCallback((attrs) => {
    setForm(prev => ({ ...prev, attributes: attrs }))
    const generated = generateSkus(form.code || 'PROD', attrs)
    setSkus(generated)
  }, [form.code])

  /* Quando código muda, regenera SKUs com novo prefixo */
  useEffect(() => {
    if (form.type === PRODUCT_TYPES.VARIANT && form.attributes?.length) {
      setSkus(generateSkus(form.code || 'PROD', form.attributes))
    }
  }, [form.code]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    const validate = form.type === PRODUCT_TYPES.VARIANT
      ? validateVariantProduct : validateSimpleProduct
    const errs = validate(form)
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      const payload = {
        ...form,
        skus: form.type === PRODUCT_TYPES.VARIANT
          ? skus
          : [{
              code:           form.code,
              attributes:     {},
              priceWholesale: Number(form.priceWholesale) || 0,
              stockMin:       Number(form.stockMin) || 0,
              stock:          product?.skus?.[0]?.stock ?? 0,
            }],
      }
      await onSave(payload)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const isVariant = form.type === PRODUCT_TYPES.VARIANT

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()}>
      <Modal.Content
        title={isEdit ? 'Editar produto' : 'Novo produto'}
        description={isEdit ? `Editando: ${product.name}` : 'Preencha os dados do produto'}
        size="lg"
      >
        <div className="space-y-5 py-1">

          {/* ── Tipo ── */}
          <div>
            <p className="text-sm font-medium text-[var(--color-text)] mb-2">Tipo de produto</p>
            <div className="flex gap-3">
              {[
                { value: PRODUCT_TYPES.SIMPLE,  label: 'Simples',       desc: '1 SKU' },
                { value: PRODUCT_TYPES.VARIANT, label: 'Com grade',     desc: 'N SKUs por combinação' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setForm(prev => ({ ...prev, type: opt.value, attributes: [], skus: [] }))
                    setSkus([])
                  }}
                  disabled={isEdit}
                  className={`
                    flex-1 rounded-xl border-2 p-3 text-left transition-all duration-150
                    disabled:opacity-60 disabled:cursor-not-allowed
                    ${form.type === opt.value
                      ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-blue-950'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
                    }
                  `}
                >
                  <p className={`text-sm font-semibold ${form.type === opt.value ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
            {isEdit && (
              <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mt-1.5">
                <Info size={11} /> Tipo não pode ser alterado após criação.
              </p>
            )}
          </div>

          {/* ── Dados básicos ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nome do produto *"
              placeholder="Ex: Tênis Runner Pro"
              value={form.name}
              onChange={set('name')}
              error={errors.name}
              wrapperClassName="sm:col-span-2"
            />
            <Input
              label="Código / Referência *"
              placeholder="Ex: PROD-001"
              value={form.code}
              onChange={set('code')}
              error={errors.code}
            />
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                Categoria *
              </label>
              <select
                value={form.category}
                onChange={set('category')}
                className={`
                  w-full h-10 px-3 rounded-[var(--radius-md)] text-sm
                  bg-[var(--color-bg)] border text-[var(--color-text)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
                  ${errors.category ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'}
                `}
              >
                <option value="">Selecionar categoria…</option>
                {DEFAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.category && (
                <p className="text-xs text-[var(--color-error)] mt-1">{errors.category}</p>
              )}
            </div>
          </div>

          {/* ── Foto ── */}
          <ImageUpload
            imageUrl={form.imageUrl}
            onImageChange={(url) => setForm(prev => ({ ...prev, imageUrl: url }))}
          />

          {/* ── Preço / estoque — só produto simples ── */}
          {!isVariant && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Preço atacado (R$)"
                placeholder="0,00"
                type="number"
                min="0"
                step="0.01"
                value={form.priceWholesale}
                onChange={set('priceWholesale')}
                error={errors.priceWholesale}
              />
              <Input
                label="Estoque mínimo"
                placeholder="0"
                type="number"
                min="0"
                value={form.stockMin}
                onChange={set('stockMin')}
              />
            </div>
          )}

          {/* ── Grade de atributos ── */}
          {isVariant && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--color-text)]">Atributos da grade</p>
                {skus.length > 0 && (
                  <Badge variant="default" size="sm">{skus.length} SKUs</Badge>
                )}
              </div>
              {errors.attributes && (
                <p className="text-xs text-[var(--color-error)]">{errors.attributes}</p>
              )}
              <AttributeBuilder
                attributes={form.attributes}
                onChange={handleAttributeChange}
              />

              {/* SKU Grid */}
              {skus.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[var(--color-text)]">SKUs gerados</p>
                  <SkuGrid skus={skus} onChange={setSkus} />
                </div>
              )}
            </div>
          )}
        </div>

        <Modal.Footer>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving
              ? <><RefreshCw size={14} className="animate-spin" /> Salvando…</>
              : isEdit ? 'Salvar alterações' : 'Criar produto'
            }
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  )
}
