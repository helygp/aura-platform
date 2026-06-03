const footerLinks = {
  Produto: [
    { label: 'Funcionalidades', href: '#features' },
    { label: 'Preços',          href: '#pricing' },
    { label: 'Comparativo',     href: '#comparativo' },
    { label: 'Changelog',       href: '#' },
  ],
  Empresa: [
    { label: 'Sobre nós',    href: '#' },
    { label: 'Blog',         href: '#' },
    { label: 'Parceiros',    href: '#' },
    { label: 'Contato',      href: 'mailto:contato@aurabr.app' },
  ],
  Suporte: [
    { label: 'Documentação', href: '#' },
    { label: 'FAQ',          href: '#faq' },
    { label: 'Status',       href: '#' },
    { label: 'WhatsApp',     href: 'https://wa.me/5511999999999' },
  ],
  Legal: [
    { label: 'Termos de Uso',          href: '/termos' },
    { label: 'Política de Privacidade', href: '/privacidade' },
    { label: 'LGPD',                    href: '/lgpd' },
    { label: 'Cookies',                 href: '/cookies' },
  ],
}

export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Top row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-md gradient-brand flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="font-heading font-bold text-base text-[var(--color-text)]">
                Aura <span className="text-[var(--color-primary)]">Platform</span>
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-4">
              SaaS white-label para gestão integrada de empresas brasileiras.
            </p>
            <div className="text-xs text-[var(--color-text-muted)]">
              🇧🇷 Feito no Brasil
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <h4 className="text-xs font-semibold text-[var(--color-text)] uppercase tracking-wider mb-4">{group}</h4>
              <ul className="space-y-2.5">
                {links.map(link => (
                  <li key={link.label}>
                    <a href={link.href}
                       className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="border-t border-[var(--color-border)] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--color-text-muted)]">
            © {new Date().getFullYear()} Aura Cloud Solutions LTDA. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
            <span>CNPJ: 00.000.000/0001-00</span>
            <span>•</span>
            <a href="mailto:contato@aurabr.app" className="hover:text-[var(--color-text)] transition-colors">
              contato@aurabr.app
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
