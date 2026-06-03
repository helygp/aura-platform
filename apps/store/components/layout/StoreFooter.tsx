/**
 * components/layout/StoreFooter.tsx
 * Footer da loja — apenas nome do tenant, sem referência à Aura.
 */
import { type TenantTheme } from '@/lib/tenant'

interface Props {
  theme: TenantTheme
}

export default function StoreFooter({ theme }: Props) {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="text-sm font-semibold text-foreground">{theme.name}</span>
          <p className="text-xs text-muted-foreground">
            © {year} {theme.name}. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
