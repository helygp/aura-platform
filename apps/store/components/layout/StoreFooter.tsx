/**
 * components/layout/StoreFooter.tsx
 * Footer moderno com links de navegação e contato do tenant.
 */
import Link from 'next/link'
import { type TenantTheme } from '@/lib/tenant'

interface Props { theme: TenantTheme }

export default function StoreFooter({ theme }: Props) {
  const year = new Date().getFullYear()
  const whatsapp = theme.whatsapp?.replace(/\D/g, '')

  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">

        {/* Grid principal */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3">

          {/* Coluna marca */}
          <div className="flex flex-col gap-4">
            {theme.logoUrl ? (
              <img src={theme.logoUrl} alt={theme.name} className="h-8 w-auto object-contain object-left" />
            ) : (
              <span className="text-base font-extrabold tracking-tight text-foreground">{theme.name}</span>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {theme.heroSubtitle ?? `Atacado B2B para lojistas. Compre por grade, pague por peça.`}
            </p>
            {/* WhatsApp */}
            {whatsapp && (
              <a
                href={`https://wa.me/55${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-2 rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                <WhatsAppIcon />
                Fale conosco
              </a>
            )}
          </div>

          {/* Coluna loja */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Loja</p>
            <ul className="flex flex-col gap-2">
              {[
                { href: '/catalogo',       label: 'Catálogo de produtos' },
                { href: '/carrinho',       label: 'Meu carrinho' },
                { href: '/conta/pedidos',  label: 'Meus pedidos' },
                { href: '/conta/login',    label: 'Entrar / Cadastrar' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-muted-foreground transition hover:text-foreground">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Coluna info */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Informações</p>
            <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <GradeIcon />
                <span>Vendas por grade — Cor × Tamanho</span>
              </li>
              <li className="flex items-start gap-2">
                <TruckIcon />
                <span>Entrega para todo o Brasil</span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldIcon />
                <span>Cadastro B2B exclusivo para lojistas</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Rodapé inferior */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {year} {theme.name}. Todos os direitos reservados.
          </p>
          <p className="text-xs text-muted-foreground">
            Plataforma B2B · Atacado
          </p>
        </div>
      </div>
    </footer>
  )
}

// ─── Ícones ───────────────────────────────────────────────────────────────────

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.528 5.855L0 24l6.335-1.508A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.96 0-3.8-.56-5.36-1.51l-.38-.23-3.76.895.91-3.67-.25-.39A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
    </svg>
  )
}
function GradeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  )
}
function TruckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    </svg>
  )
}
function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}
