import React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

export function KpiCard({ icon: Icon, label, value, sub, trend, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50   text-blue-600   dark:bg-blue-950  dark:text-blue-400',
    green:  'bg-green-50  text-green-600  dark:bg-green-950 dark:text-green-400',
    yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400',
    red:    'bg-red-50    text-red-600    dark:bg-red-950   dark:text-red-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
  }
  const isUp = trend > 0
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">{label}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="text-2xl font-bold text-[var(--color-text)] mb-1">{value}</p>
      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 font-medium ${isUp ? 'text-green-600' : 'text-red-500'}`}>
            {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend)}
          </span>
        )}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  )
}
