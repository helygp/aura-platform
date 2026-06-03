const pillars = [
  {
    icon: '🏢',
    title: 'ERP Mobile-First',
    desc: 'Gestão completa de produtos, estoque, pedidos, clientes e usuários. Funciona perfeitamente no celular.',
  },
  {
    icon: '🛒',
    title: 'Loja B2B Própria',
    desc: 'Catálogo online com grade de variações, carrinho, checkout e rastreamento de pedidos para seus compradores.',
  },
  {
    icon: '💬',
    title: 'WhatsApp com IA',
    desc: 'Bot que responde pedidos, consulta estoque e envia atualizações automaticamente pelo WhatsApp.',
  },
  {
    icon: '🎨',
    title: '100% White-Label',
    desc: 'Sua marca, suas cores, seu domínio. Seus clientes verão apenas a identidade da sua empresa.',
  },
]

export default function Solution() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[var(--color-primary)]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 rounded-full px-4 py-1.5 mb-6">
            <span className="text-[var(--color-primary)] text-xs font-semibold uppercase tracking-widest">A solução</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Tudo integrado na{' '}
            <span className="gradient-text">Aura Platform</span>
          </h2>
          <p className="text-[var(--color-text-muted)] text-lg max-w-2xl mx-auto">
            Uma única plataforma que conecta todas as partes do seu negócio.
            Dados em tempo real, automações inteligentes, sem integrações frágeis.
          </p>
        </div>

        {/* Architecture diagram */}
        <div className="relative mb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {pillars.map((p, i) => (
              <div key={i}
                   className="glass rounded-xl p-5 text-center border border-[var(--color-primary)]/20 hover:border-[var(--color-primary)]/50 transition-all hover:-translate-y-1 group">
                <div className="text-4xl mb-3 group-hover:animate-float inline-block">{p.icon}</div>
                <h3 className="font-heading font-bold text-sm text-[var(--color-text)] mb-2">{p.title}</h3>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
          {/* Connecting line visual */}
          <div className="hidden md:block absolute top-1/2 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-[var(--color-primary)]/30 to-transparent -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Value prop row */}
        <div className="bg-gradient-to-r from-[var(--color-primary)]/10 via-[var(--color-surface)] to-purple-900/10 rounded-2xl border border-[var(--color-border)] p-8 grid md:grid-cols-3 gap-8 text-center">
          {[
            { emoji: '⚡', title: 'Provisionamento em minutos', sub: 'Preencha o formulário → sistema pronto, domínio configurado, e-mail enviado automaticamente.' },
            { emoji: '🔒', title: 'Segurança enterprise',      sub: 'JWT httpOnly, RBAC por papel, multi-tenant isolado, dados de cada cliente completamente separados.' },
            { emoji: '🇧🇷', title: 'Made in Brazil',           sub: 'Pagar.me nativo, suporte em português, LGPD compliant, servidores no Brasil.' },
          ].map(v => (
            <div key={v.title}>
              <div className="text-3xl mb-3">{v.emoji}</div>
              <div className="font-bold text-[var(--color-text)] mb-2">{v.title}</div>
              <div className="text-sm text-[var(--color-text-muted)] leading-relaxed">{v.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
