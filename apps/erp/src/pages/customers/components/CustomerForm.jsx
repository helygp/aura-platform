/**
 * pages/customers/components/CustomerForm.jsx
 *
 * Modal de cadastro/edição de cliente atacadista.
 *
 * Campos:
 *   Dados básicos: nome, tipo (PJ/PF), CNPJ/CPF (com máscara), WhatsApp, e-mail
 *   Financeiro:    limite de crédito, status
 *   Endereço:      CEP (busca ViaCEP), rua, cidade, estado
 *
 * Props:
 *   open     : boolean
 *   onClose  : fn
 *   customer : objeto a editar (null = novo)
 *   onSave   : (data) => Promise
 */

import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { Modal, Button, Input } from '@aura/ui'
import {
  PERSON_TYPE, CUSTOMER_STATUS, BR_STATES,
  maskCNPJ, maskCPF, maskPhone, maskCEP,
  validateCustomer,
} from '../customersTypes.js'

const EMPTY = {
  name: '', personType: PERSON_TYPE.PJ, document: '',
  whatsapp: '', email: '', status: CUSTOMER_STATUS.ACTIVE,
  creditLimit: '',
  address: { street: '', city: '', state: '', zip: '' },
}

function toForm(customer) {
  if (!customer) return EMPTY
  return {
    ...EMPTY,
    ...customer,
    creditLimit: customer.creditLimit ?? '',
    address: { ...EMPTY.address, ...(customer.address ?? {}) },
  }
}

export function CustomerForm({ open, onClose, customer, onSave }) {
  const isEdit = Boolean(customer?.id)
  const [form,       setForm]       = useState(() => toForm(customer))
  const [errors,     setErrors]     = useState({})
  const [saving,     setSaving]     = useState(false)
  const [cepLoading, setCepLoading] = useState(false)

  useEffect(() => {
    if (open) { setForm(toForm(customer)); setErrors({}) }
  }, [open, customer])

  const set = (field) => (e) =>
    setForm(prev => ({ ...prev, [field]: e.target?.value ?? e }))

  const setAddress = (field) => (e) =>
    setForm(prev => ({ ...prev, address: { ...prev.address, [field]: e.target?.value ?? e } }))

  /* ─── Máscara documento dinâmica ─── */
  const handleDocument = (e) => {
    const raw = e.target.value
    const masked = form.personType === PERSON_TYPE.PJ ? maskCNPJ(raw) : maskCPF(raw)
    setForm(prev => ({ ...prev, document: masked }))
  }

  const handleWhatsApp = (e) =>
    setForm(prev => ({ ...prev, whatsapp: maskPhone(e.target.value) }))

  const handleZip = (e) =>
    setForm(prev => ({ ...prev, address: { ...prev.address, zip: maskCEP(e.target.value) } }))

  /* ─── Busca CEP via ViaCEP ─── */
  const fetchCep = useCallback(async () => {
    const cep = form.address.zip.replace(/\D/g, '')
    if (cep.length !== 8) return
    setCepLoading(true)
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await res.json()
      if (data.erro) return
      setForm(prev => ({
        ...prev,
        address: {
          ...prev.address,
          street: data.logradouro || prev.address.street,
          city:   data.localidade  || prev.address.city,
          state:  data.uf          || prev.address.state,
        },
      }))
    } catch {} finally {
      setCepLoading(false)
    }
  }, [form.address.zip])

  const handleSubmit = async () => {
    const errs = validateCustomer(form)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      await onSave({ ...form, id: customer?.id })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()}>
      <Modal.Content
        title={isEdit ? 'Editar cliente' : 'Novo cliente'}
        description="Dados do cliente atacadista"
        size="lg"
      >
        <div className="space-y-5 py-1">

          {/* ── Tipo de pessoa ── */}
          <div>
            <p className="text-sm font-medium text-[var(--color-text)] mb-2">Tipo de pessoa</p>
            <div className="flex gap-3">
              {[
                { value: PERSON_TYPE.PJ, label: 'Pessoa Jurídica', desc: 'CNPJ' },
                { value: PERSON_TYPE.PF, label: 'Pessoa Física',   desc: 'CPF'  },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, personType: opt.value, document: '' }))}
                  className={`
                    flex-1 rounded-xl border-2 p-3 text-left transition-all duration-150
                    ${form.personType === opt.value
                      ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-blue-950'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
                    }
                  `}
                >
                  <p className={`text-sm font-semibold ${form.personType === opt.value ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Dados básicos ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nome / Razão social *"
              placeholder={form.personType === PERSON_TYPE.PJ ? 'Razão social' : 'Nome completo'}
              value={form.name}
              onChange={set('name')}
              error={errors.name}
              wrapperClassName="sm:col-span-2"
            />
            <Input
              label={form.personType === PERSON_TYPE.PJ ? 'CNPJ *' : 'CPF *'}
              placeholder={form.personType === PERSON_TYPE.PJ ? '00.000.000/0001-00' : '000.000.000-00'}
              value={form.document}
              onChange={handleDocument}
              error={errors.document}
            />
            <Input
              label="WhatsApp *"
              placeholder="(11) 99999-0000"
              value={form.whatsapp}
              onChange={handleWhatsApp}
              error={errors.whatsapp}
            />
            <Input
              label="E-mail"
              placeholder="contato@empresa.com.br"
              type="email"
              value={form.email}
              onChange={set('email')}
            />
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={set('status')}
                className="w-full h-10 px-3 rounded-[var(--radius-md)] text-sm bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                {Object.values(CUSTOMER_STATUS).map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Financeiro ── */}
          <div>
            <p className="text-sm font-medium text-[var(--color-text)] mb-3">Financeiro</p>
            <Input
              label="Limite de crédito (R$)"
              placeholder="0,00"
              type="number"
              min="0"
              step="0.01"
              value={form.creditLimit}
              onChange={set('creditLimit')}
              error={errors.creditLimit}
            />
          </div>

          {/* ── Endereço ── */}
          <div>
            <p className="text-sm font-medium text-[var(--color-text)] mb-3">Endereço</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* CEP com busca */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">CEP</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="00000-000"
                    value={form.address.zip}
                    onChange={handleZip}
                    onBlur={fetchCep}
                    className="flex-1 h-10 px-3 rounded-[var(--radius-md)] text-sm bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                  <button
                    type="button"
                    onClick={fetchCep}
                    disabled={cepLoading || form.address.zip.replace(/\D/g,'').length < 8}
                    className="h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] disabled:opacity-40 transition-colors"
                    title="Buscar CEP"
                  >
                    {cepLoading
                      ? <RefreshCw size={14} className="animate-spin" />
                      : <Search size={14} />
                    }
                  </button>
                </div>
              </div>

              <Input
                label="Rua / Endereço"
                placeholder="Rua das Flores, 123"
                value={form.address.street}
                onChange={setAddress('street')}
                wrapperClassName="sm:col-span-2"
              />
              <Input
                label="Cidade"
                placeholder="São Paulo"
                value={form.address.city}
                onChange={setAddress('city')}
              />
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Estado</label>
                <select
                  value={form.address.state}
                  onChange={setAddress('state')}
                  className="w-full h-10 px-3 rounded-[var(--radius-md)] text-sm bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">UF</option>
                  {BR_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

        </div>

        <Modal.Footer>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving
              ? <><RefreshCw size={14} className="animate-spin" /> Salvando…</>
              : isEdit ? 'Salvar alterações' : 'Criar cliente'
            }
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  )
}
