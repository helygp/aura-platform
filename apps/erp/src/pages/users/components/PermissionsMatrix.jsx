/**
 * pages/users/components/PermissionsMatrix.jsx
 *
 * Tabela visual de permissões por módulo × papel.
 * Leitura apenas — serve como referência para o admin.
 * Células: "total" = check verde, "leitura" = olho âmbar, "—" = traço cinza.
 */

import React from 'react'
import { Check, Eye, Minus } from 'lucide-react'
import { Card } from '@aura/ui'
import { MODULE_PERMISSIONS, ROLE_LIST } from '../usersTypes.js'

function PermCell({ value }) {
  if (value === 'total') return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
      <Check size={13} />
      <span className="hidden sm:inline">Total</span>
    </span>
  )
  if (value === 'leitura') return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
      <Eye size={13} />
      <span className="hidden sm:inline">Leitura</span>
    </span>
  )
  return (
    <span className="inline-flex items-center text-xs text-[var(--color-text-disabled)]">
      <Minus size={13} />
    </span>
  )
}

export function PermissionsMatrix() {
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-[var(--color-text)] mb-1">Matriz de permissões</p>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        Referência dos acessos por papel. Não é editável — para alterar, mude o papel do usuário.
      </p>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
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
            {MODULE_PERMISSIONS.map(row => (
              <tr key={row.key} className="hover:bg-[var(--color-bg-subtle)] transition-colors">
                <td className="px-4 py-2.5 text-sm font-medium text-[var(--color-text)]">
                  {row.module}
                </td>
                {ROLE_LIST.map(role => (
                  <td key={role.key} className="px-4 py-2.5 text-center">
                    <PermCell value={row.perms[role.key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
