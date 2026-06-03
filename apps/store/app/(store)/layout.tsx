/**
 * app/(store)/layout.tsx
 * Layout do grupo de rotas da loja — StoreHeader + StoreFooter + AuthProvider.
 */
import { headers } from 'next/headers'
import { fetchTenantTheme, DEFAULT_THEME } from '@/lib/tenant'
import StoreHeader from '@/components/layout/StoreHeader'
import StoreFooter from '@/components/layout/StoreFooter'
import TenantProvider from '@/components/layout/TenantProvider'
import { AuthProvider } from '@/lib/useAuth'

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const slug  = headers().get('x-tenant-slug') ?? 'demo'
  const theme = (await fetchTenantTheme(slug)) ?? DEFAULT_THEME

  return (
    // TenantProvider já está no root layout, mas precisamos de AuthProvider
    // dentro dele — como o root já envolve, aqui só adicionamos o AuthProvider.
    <AuthProvider>
      <div className="flex min-h-screen flex-col">
        <StoreHeader />
        <main className="flex-1">{children}</main>
        <StoreFooter theme={theme} />
      </div>
    </AuthProvider>
  )
}
