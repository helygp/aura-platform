/**
 * pages/ProfilePage.jsx
 *
 * Página de perfil do usuário autenticado.
 * Permite editar nome e trocar senha.
 * Mostra papel, tenant e data de entrada.
 */

import React, { useState } from 'react'
import { RefreshCw, Save, Eye, EyeOff, Check, ShieldCheck } from 'lucide-react'
import { Card, Button, Input } from '@aura/ui'
import { useAuth }       from '../auth/AuthContext.jsx'
import { useTenantTheme } from '../hooks/useTenantTheme.js'
import { ROLES }          from './users/usersTypes.js'

function PasswordInput({ label, value, onChange, error, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        label={label}
        placeholder={placeholder}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        error={error}
      />
      <button
        type="button"
        onClick={() => setShow(p => !p)}
        className="absolute right-3 bottom-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

export function ProfilePage() {
  const { user }            = useAuth()
  const { tenantInfo }      = useTenantTheme()

  const [name,        setName]        = useState(user?.name ?? '')
  const [savingName,  setSavingName]  = useState(false)
  const [savedName,   setSavedName]   = useState(false)

  const [pwdForm,     setPwdForm]     = useState({ current: '', next: '', confirm: '' })
  const [pwdErrors,   setPwdErrors]   = useState({})
  const [savingPwd,   setSavingPwd]   = useState(false)
  const [savedPwd,    setSavedPwd]    = useState(false)

  const roleMeta = ROLES[user?.role]

  /* ─── Salvar nome ─── */
  const handleSaveName = async () => {
    if (!name.trim()) return
    setSavingName(true)
    try {
      await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      })
    } catch {}
    setSavingName(false)
    setSavedName(true)
    setTimeout(() => setSavedName(false), 2500)
  }

  /* ─── Trocar senha ─── */
  const handleSavePwd = async () => {
    const errs = {}
    if (!pwdForm.current.trim()) errs.current = 'Informe a senha atual.'
    if (pwdForm.next.length < 8) errs.next    = 'Mínimo 8 caracteres.'
    if (pwdForm.next !== pwdForm.confirm) errs.confirm = 'Senhas não coincidem.'
    if (Object.keys(errs).length) { setPwdErrors(errs); return }
    setSavingPwd(true)
    try {
      const res = await fetch('/api/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword: pwdForm.current, newPassword: pwdForm.next }),
      })
      if (!res.ok) { setPwdErrors({ current: 'Senha atual incorreta.' }); return }
    } catch {}
    setSavingPwd(false)
    setSavedPwd(true)
    setPwdForm({ current: '', next: '', confirm: '' })
    setTimeout(() => setSavedPwd(false), 2500)
  }

  return (
    <div className="space-y-5 max-w-lg">

      <div>
        <h2 className="text-lg font-bold text-[var(--color-text)]">Meu perfil</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Gerencie suas informações e senha</p>
      </div>

      {/* ── Identidade ── */}
      <Card className="p-5 space-y-4">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)] text-white text-2xl font-bold flex items-center justify-center shrink-0">
            {(name || user?.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-base font-bold text-[var(--color-text)]">{user?.name ?? user?.email}</p>
            <p className="text-sm text-[var(--color-text-muted)]">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {roleMeta && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleMeta.bg} ${roleMeta.color} ${roleMeta.border}`}>
                  <ShieldCheck size={11} className="mr-1" />
                  {roleMeta.label}
                </span>
              )}
              {tenantInfo?.name && (
                <span className="text-xs text-[var(--color-text-muted)]">{tenantInfo.name}</span>
              )}
            </div>
          </div>
        </div>

        {/* Nome */}
        <div className="space-y-2">
          <Input
            label="Nome de exibição"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Seu nome"
          />
          <Button
            size="sm"
            onClick={handleSaveName}
            disabled={savingName || !name.trim() || name === user?.name}
          >
            {savedName
              ? <><Check size={13} /> Salvo!</>
              : savingName
              ? <><RefreshCw size={13} className="animate-spin" /> Salvando…</>
              : <><Save size={13} /> Salvar nome</>
            }
          </Button>
        </div>
      </Card>

      {/* ── Senha ── */}
      <Card className="p-5 space-y-4">
        <p className="text-sm font-semibold text-[var(--color-text)]">Alterar senha</p>
        <PasswordInput
          label="Senha atual"
          placeholder="••••••••"
          value={pwdForm.current}
          onChange={e => { setPwdForm(p => ({ ...p, current: e.target.value })); setPwdErrors(p => ({ ...p, current: undefined })) }}
          error={pwdErrors.current}
        />
        <PasswordInput
          label="Nova senha (mín. 8 caracteres)"
          placeholder="••••••••"
          value={pwdForm.next}
          onChange={e => { setPwdForm(p => ({ ...p, next: e.target.value })); setPwdErrors(p => ({ ...p, next: undefined })) }}
          error={pwdErrors.next}
        />
        <PasswordInput
          label="Confirmar nova senha"
          placeholder="••••••••"
          value={pwdForm.confirm}
          onChange={e => { setPwdForm(p => ({ ...p, confirm: e.target.value })); setPwdErrors(p => ({ ...p, confirm: undefined })) }}
          error={pwdErrors.confirm}
        />
        <Button
          size="sm"
          onClick={handleSavePwd}
          disabled={savingPwd || !pwdForm.current || !pwdForm.next || !pwdForm.confirm}
        >
          {savedPwd
            ? <><Check size={13} /> Senha alterada!</>
            : savingPwd
            ? <><RefreshCw size={13} className="animate-spin" /> Salvando…</>
            : 'Alterar senha'
          }
        </Button>
      </Card>

    </div>
  )
}
