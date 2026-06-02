import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@aura/ui'

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 bg-[var(--color-bg)]">
      <p className="text-5xl font-bold text-[var(--color-text-muted)]">404</p>
      <p className="text-[var(--color-text-muted)]">Página não encontrada.</p>
      <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>Voltar</Button>
    </div>
  )
}

export function ForbiddenPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 bg-[var(--color-bg)]">
      <p className="text-5xl font-bold text-[var(--color-text-muted)]">403</p>
      <p className="text-[var(--color-text-muted)]">Sem permissão para esta página.</p>
      <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>Voltar</Button>
    </div>
  )
}
