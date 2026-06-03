import React from 'react'
import { AlertTriangle } from 'lucide-react'

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
        <AlertTriangle size={22} className="text-red-500" />
      </div>
      <p className="text-[var(--color-text-muted)] text-sm">{message ?? 'Erro ao carregar dados.'}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-[var(--color-primary)] hover:underline font-medium"
        >
          Tentar novamente
        </button>
      )}
    </div>
  )
}
