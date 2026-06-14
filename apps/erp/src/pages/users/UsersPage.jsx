/**
 * pages/users/UsersPage.jsx
 *
 * Gestão de usuários e papéis.
 *
 * Layout:
 *   1. Header: título + stats + botão "Convidar"
 *   2. Tabela (desktop) / cards (mobile):
 *      Usuário (avatar + nome + email), Login, Perfis (multi-badges),
 *      WhatsApp, Status, Último acesso, Ações
 *   3. Matriz de permissões (collapsible)
 *   4. InviteModal (criação OU edição via prop `user`)
 *
 * Multi-role: badges múltiplos por usuário. Edição via modal (sem dropdown inline).
 */

import { useSortable } from '../../hooks/useSortable.js'
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  UserPlus, RefreshCw, MoreVertical, ShieldCheck, Pencil,
  Mail, Ban, RotateCcw, ChevronDown,
  Users, UserCheck, Clock, ChevronUp,
  ChevronsUpDown,
} from 'lucide-react'
import { Card, Skeleton, Button, Modal } from '@aura/ui'
import { InviteModal }       from './components/InviteModal.jsx'
import { PermissionsMatrix } from './components/PermissionsMatrix.jsx'
import { useUsers }          from './useUsers.js'
import { useAuth }           from '../../auth/AuthContext.jsx'
import {
  ROLES, ROLE_LIST, USER_STATUS, STATUS_META, fmtDate, userRoles,
} from './usersTypes.js'

/* ─── Skeleton ─── */
function TableSkeleton() {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
            <tr>
              {['Usuário','Login','Perfis','WhatsApp','Status','Último acesso',''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {[...Array(5)].map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3"><div className="flex items-center gap-3"><Skeleton variant="circle" width={36} height={36} /><div className="space-y-1.5"><Skeleton width={120} height={12} /><Skeleton width={160} height={10} /></div></div></td>
                <td className="px-4 py-3"><Skeleton width={70} height={14} /></td>
                <td className="px-4 py-3"><Skeleton width={120} height={22} /></td>
                <td className="px-4 py-3"><Skeleton width={80} height={14} /></td>
                <td className="px-4 py-3"><Skeleton width={70} height={20} /></td>
                <td className="px-4 py-3"><Skeleton width={90} height={12} /></td>
                <td className="px-4 py-3"><Skeleton width={28} height={28} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ─── Stat chip ─── */
function StatChip({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={14} />
      </div>
      <div>
        <p className="text-sm font-bold text-[var(--color-text)] tabular-nums leading-none">{value}</p>
        <p className="text-[10px] text-[var(--color-text-muted)] leading-none mt-0.5">{label}</p>
      </div>
    </div>
  )
}

/* ─── Badge único de papel ─── */
function RoleBadge({ role }) {
  const meta = ROLES[role]
  if (!meta) return <span className="text-xs text-[var(--color-text-muted)]">{role}</span>
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.bg} ${meta.color} ${meta.border}`}>
      {meta.label}
    </span>
  )
}

/* ─── Badges múltiplos (ordenados por nível decrescente) ─── */
function RolesBadges({ user }) {
  const roles = userRoles(user).sort((a, b) => (ROLES[b]?.level ?? 0) - (ROLES[a]?.level ?? 0))
  if (!roles.length) return <span className="text-xs text-[var(--color-text-muted)]">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map(r => <RoleBadge key={r} role={r} />)}
    </div>
  )
}

/* ─── Badge de status ─── */
function StatusBadge({ status }) {
  const meta = STATUS_META[status]
  if (!meta) return null
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${meta.bg} ${meta.color} ${meta.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
      {meta.label}
    </span>
  )
}

/* ─── Menu de ações ─── */
function ActionsMenu({ user, onEdit, onRevoke, onReactivate, onResend }) {
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(null)
  const [coords,  setCoords]  = useState(null)
  const btnRef = useRef(null)

  const act = async (fn, key) => {
    setLoading(key); setOpen(false)
    try { await fn() } finally { setLoading(null) }
  }

  const toggle = (e) => {
    e.stopPropagation()
    if (open) { setOpen(false); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setCoords({ top: r.bottom + 4, right: window.innerWidth - r.right })
    setOpen(true)
  }

  /* Menu em portal (position:fixed) p/ escapar do overflow do grid.
     Fecha ao rolar/redimensionar pra nao desalinhar. */
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={toggle}
        disabled={Boolean(loading)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] disabled:opacity-40 transition-colors"
        aria-label="Ações"
      >
        {loading
          ? <RefreshCw size={14} className="animate-spin" />
          : <MoreVertical size={15} />
        }
      </button>
      {open && coords && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[61] w-44 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-md)] overflow-hidden py-1"
            style={{ top: coords.top, right: coords.right }}
            onClick={(e) => e.stopPropagation()}
          >

            <button
              onClick={() => { setOpen(false); onEdit() }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
            >
              <Pencil size={14} className="text-[var(--color-text-muted)]" />
              Editar
            </button>

            {user.status === USER_STATUS.INVITED && (
              <button
                onClick={() => act(onResend, 'resend')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
              >
                <Mail size={14} className="text-[var(--color-text-muted)]" />
                Reenviar convite
              </button>
            )}

            {!user.isSelf && (
              user.status !== USER_STATUS.REVOKED ? (
                <button
                  onClick={() => act(onRevoke, 'revoke')}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                >
                  <Ban size={14} />
                  Revogar acesso
                </button>
              ) : (
                <button
                  onClick={() => act(onReactivate, 'reactivate')}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-950 transition-colors"
                >
                  <RotateCcw size={14} />
                  Reativar acesso
                </button>
              )
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

/* ─── Linha tabela ─── */
function UserRow({ user, onEdit, onRevoke, onReactivate, onResend, isAdmin }) {
  const initial = (user.name ?? user.email).charAt(0).toUpperCase()
  const isRevoked = user.status === USER_STATUS.REVOKED

  return (
    <tr
      onClick={isAdmin ? () => onEdit(user) : undefined}
      className={`border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-subtle)] ${isRevoked ? 'opacity-50' : ''} ${isAdmin ? 'cursor-pointer' : ''}`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white"
            style={{ backgroundColor: 'var(--color-primary)', opacity: isRevoked ? 0.5 : 1 }}>
            {initial}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-[var(--color-text)] truncate max-w-[160px]">{user.name}</p>
              {user.isSelf && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] shrink-0">você</span>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] truncate max-w-[180px]">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs font-mono text-[var(--color-text)]">{user.login || '—'}</span>
      </td>
      <td className="px-4 py-3">
        <RolesBadges user={user} />
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-[var(--color-text-muted)]">{user.whatsapp || '—'}</span>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={user.status} />
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-[var(--color-text-muted)]">
          {user.lastLogin ? fmtDate(user.lastLogin) : '—'}
        </span>
      </td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <ActionsMenu
          user={user}
          onEdit={() => onEdit(user)}
          onRevoke={() => onRevoke(user.id)}
          onReactivate={() => onReactivate(user.id)}
          onResend={() => onResend(user.id)}
        />
      </td>
    </tr>
  )
}

/* ─── Card mobile ─── */
function UserCard({ user, onEdit, onRevoke, onReactivate, onResend }) {
  const initial   = (user.name ?? user.email).charAt(0).toUpperCase()
  const isRevoked = user.status === USER_STATUS.REVOKED

  return (
    <div className={`p-4 border-b border-[var(--color-border)] last:border-0 ${isRevoked ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-[var(--color-primary)] text-white text-sm font-bold">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-[var(--color-text)] truncate">{user.name}</p>
              {user.isSelf && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]">você</span>}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] truncate">{user.login || user.email}</p>
            <p className="text-[10px] text-[var(--color-text-muted)] truncate">{user.email}</p>
          </div>
        </div>
        <ActionsMenu
          user={user}
          onEdit={() => onEdit(user)}
          onRevoke={() => onRevoke(user.id)}
          onReactivate={() => onReactivate(user.id)}
          onResend={() => onResend(user.id)}
        />
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap" style={{ paddingLeft: '52px' }}>
        <RolesBadges user={user} />
        <StatusBadge status={user.status} />
        {user.lastLogin && (
          <span className="text-[10px] text-[var(--color-text-muted)]">
            • {fmtDate(user.lastLogin)}
          </span>
        )}
      </div>
    </div>
  )
}

/* ─── Colunas tabela ─── */
const USER_COLS = [
  { key: 'name',      label: 'Usuário',       sortable: true,  align: 'text-left' },
  { key: 'login',     label: 'Login',         sortable: true,  align: 'text-left' },
  { key: 'roles',     label: 'Perfis',        sortable: false, align: 'text-left' },
  { key: 'whatsapp',  label: 'WhatsApp',      sortable: false, align: 'text-left' },
  { key: 'status',    label: 'Status',        sortable: true,  align: 'text-left' },
  { key: 'lastLogin', label: 'Último acesso', sortable: true,  align: 'text-left' },
  { key: 'actions',   label: '',              sortable: false, align: 'text-left' },
]

function SortableTh({ col, sortKey, sortDir, onSort }) {
  const active = sortKey === col.key
  const align = col.align ?? 'text-left'
  return (
    <th onClick={() => col.sortable && onSort(col)}
      className={`px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap select-none ${align} ${col.sortable ? 'cursor-pointer hover:text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)] transition-colors' : ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {col.label}
        {col.sortable && (active
          ? sortDir === 'asc' ? <ChevronUp size={11} className="shrink-0" /> : <ChevronDown size={11} className="shrink-0" />
          : <ChevronsUpDown size={11} className="shrink-0 opacity-30" />
        )}
      </span>
    </th>
  )
}

/* ──────────────────────────────────────────────────────── */

export function UsersPage() {
  const {
    users, isLoading, refetch, customers,
    inviteUser, updateUser, revokeUser, reactivate, resendInvite,
    stats,
  } = useUsers()
  const { sorted: sortedUsers, sortKey: uSortKey, sortDir: uSortDir, handleSort: uHandleSort } = useSortable(users, 'name')
  const { hasRole } = useAuth()
  const isAdmin = hasRole('admin')

  const [modalOpen,    setModalOpen]    = useState(false)
  const [editTarget,   setEditTarget]   = useState(null)   // null = modo criar
  const [showMatrix,   setShowMatrix]   = useState(false)
  const [revokeTarget, setRevokeTarget] = useState(null)
  const [revoking,     setRevoking]     = useState(false)
  const [resendDone,   setResendDone]   = useState(null)

  const openCreate = useCallback(() => { setEditTarget(null); setModalOpen(true) }, [])
  const openEdit   = useCallback((user) => { setEditTarget(user); setModalOpen(true) }, [])
  const closeModal = useCallback(() => { setModalOpen(false); setEditTarget(null) }, [])

  /* Handler único pro modal: chama invite ou update conforme isEdit */
  const handleSave = useCallback(async (payload, isEdit) => {
    if (isEdit) {
      return await updateUser(editTarget.id, payload)
    } else {
      return await inviteUser(payload)
    }
  }, [editTarget, updateUser, inviteUser])

  const handleRevoke = useCallback(async (userId) => {
    setRevoking(true)
    try { await revokeUser(userId) }
    finally { setRevoking(false); setRevokeTarget(null) }
  }, [revokeUser])

  const handleResend = useCallback(async (userId) => {
    await resendInvite(userId)
    setResendDone(userId)
    setTimeout(() => setResendDone(null), 3000)
  }, [resendInvite])

  return (
    <div className="space-y-5 max-w-screen-xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">Usuários</h2>
          {!isLoading && (
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{stats.total} membros nesta conta</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isLoading && (
            <div className="hidden sm:flex items-center gap-2">
              <StatChip icon={Users}     label="Total"      value={stats.total}   color="bg-sky-50   text-sky-600   dark:bg-sky-950   dark:text-sky-400"   />
              <StatChip icon={UserCheck} label="Ativos"     value={stats.active}  color="bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400" />
              <StatChip icon={Clock}     label="Aguardando" value={stats.invited} color="bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400" />
            </div>
          )}
          <button
            onClick={refetch} disabled={isLoading}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] disabled:opacity-40 transition-colors"
            aria-label="Atualizar"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <Button size="sm" onClick={openCreate}>
            <UserPlus size={15} /> Convidar
          </Button>
        </div>
      </div>

      {/* Toast reenvio */}
      {resendDone && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300">
          <Mail size={14} className="shrink-0" />
          Convite reenviado com sucesso!
        </div>
      )}

      {/* Tabela / Cards */}
      {isLoading ? (
        <TableSkeleton />
      ) : (
        <>
          {/* Desktop */}
          <Card className="hidden md:block overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
                  <tr>
                    {USER_COLS.map(col => (
                      <SortableTh key={col.key} col={col} sortKey={uSortKey} sortDir={uSortDir} onSort={uHandleSort} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map(u => (
                    <UserRow
                      key={u.id}
                      user={u}
                      onEdit={openEdit}
                      onRevoke={setRevokeTarget}
                      onReactivate={reactivate}
                      onResend={handleResend}
                      isAdmin={isAdmin}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile */}
          <Card className="md:hidden p-0 overflow-hidden">
            {sortedUsers.map(u => (
              <UserCard
                key={u.id}
                user={u}
                onEdit={openEdit}
                onRevoke={setRevokeTarget}
                onReactivate={reactivate}
                onResend={handleResend}
              />
            ))}
          </Card>
        </>
      )}

      {/* Matriz */}
      <div>
        <button
          onClick={() => setShowMatrix(p => !p)}
          className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-3 transition-colors"
        >
          <ShieldCheck size={15} />
          Matriz de permissões
          {showMatrix ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showMatrix && <PermissionsMatrix />}
      </div>

      {/* Modal criar/editar */}
      <InviteModal
        open={modalOpen}
        onClose={closeModal}
        user={editTarget}
        customers={customers ?? []}
        onSave={handleSave}
      />

      {/* Modal confirm revogar */}
      <Modal open={Boolean(revokeTarget)} onOpenChange={v => !v && setRevokeTarget(null)}>
        <Modal.Content title="Revogar acesso" size="sm">
          <div className="py-2 space-y-3">
            <div className="flex gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
              <Ban size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">
                O usuário perderá acesso imediatamente. O histórico de ações será mantido.
              </p>
            </div>
            <p className="text-sm text-[var(--color-text)]">
              Confirmar revogação de <strong>{users.find(u => u.id === revokeTarget)?.name}</strong>?
            </p>
          </div>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setRevokeTarget(null)} disabled={revoking}>Cancelar</Button>
            <Button variant="destructive" onClick={() => handleRevoke(revokeTarget)} disabled={revoking}>
              {revoking ? <><RefreshCw size={14} className="animate-spin" /> Revogando…</> : 'Revogar acesso'}
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>

    </div>
  )
}
