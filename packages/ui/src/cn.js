import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combina classes Tailwind sem conflitos.
 * @param  {...import('clsx').ClassValue} inputs
 * @returns {string}
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
