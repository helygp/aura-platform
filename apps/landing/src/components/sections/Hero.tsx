export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 gradient-glow pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-[var(--color-primary)]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-24">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-4 py-1.5 mb-8 animate-fade-up">
          <span className="w-2 h-2 bg-[var(--color-success)] rounded-full animate-pulse" />
          <span className="text-xs text-[var(--color-text-muted)] font-medium">
            Plataforma 100% brasileira • Suporte em português
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-heading text-4xl sm:text-5xl md:text-7xl font-bold leading-tight mb-6 animate-fade-up delay-100">
          Seu negócio completo{' '}
          <br className="hidden sm:block" />
          <span className="gradient-text">em um único sistema</span>
        </h1>

        {/* Sub */}
        <p className="text-lg sm:text-xl text-[var(--color-text-muted)] max-w-3xl mx-auto mb-10 leading-relaxed animate-fade-up delay-200">
          ERP + Loja B2B + WhatsApp com IA + Painel financeiro — tudo integrado, white-label e pronto para rodar em{' '}
          <strong className="text-[var(--color-text)]">minutos</strong>.
          Sem planilhas, sem sistemas fragmentados, sem dor de cabeça.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-fade-up delay-300">
          <a href="/cadastro"
             className="gradient-cta text-white font-bold text-base px-8 py-4 rounded-lg hover:opacity-90 transition-all hover:scale-105 shadow-lg">
            Começar grátis — 14 dias ✨
          </a>
          <a href="#features"
             className="bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] font-semibold text-base px-8 py-4 rounded-lg hover:bg-[var(--color-surface-hover)] transition-all">
            Ver funcionalidades →
          </a>
        </div>

        {/* Social proof numbers */}
        <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto animate-fade-up delay-400">
          {[
            { value: '14 dias', label: 'Trial gratuito, sem cartão' },
            { value: '5 min',   label: 'Para ter sua loja online' },
            { value: '100%',    label: 'White-label e customizável' },
          ].map((item) => (
            <div key={item.value} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold gradient-text">{item.value}</div>
              <div className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-1">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Dashboard mockup */}
        <div className="mt-20 relative animate-float">
          <div className="glass rounded-xl overflow-hidden shadow-2xl border border-[var(--color-border)] max-w-4xl mx-auto">
            {/* Window chrome */}
            <div className="bg-[var(--color-surface)] px-4 py-3 flex items-center gap-2 border-b border-[var(--color-border)]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 text-center text-xs text-[var(--color-text-muted)]">acme.aurabr.app</div>
            </div>
            {/* Mock content */}
            <div className="bg-[var(--color-bg-subtle)] p-6 grid grid-cols-4 gap-4 min-h-[260px]">
              {/* Sidebar mock */}
              <div className="col-span-1 space-y-2">
                {['Dashboard','Produtos','Estoque','Pedidos','Clientes','WhatsApp'].map(item => (
                  <div key={item}
                       className={`h-8 rounded-md flex items-center px-3 text-xs ${
                         item === 'Dashboard'
                           ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                           : 'text-[var(--color-text-muted)]'
                       }`}>
                    {item}
                  </div>
                ))}
              </div>
              {/* Content mock */}
              <div className="col-span-3 space-y-4">
                {/* KPIs */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Receita Mês', value: 'R$ 48.290', up: true },
                    { label: 'Pedidos',     value: '127',       up: true },
                    { label: 'Em estoque',  value: '1.843',     up: false },
                  ].map(k => (
                    <div key={k.label} className="bg-[var(--color-surface)] rounded-lg p-3 border border-[var(--color-border)]">
                      <div className="text-xs text-[var(--color-text-muted)]">{k.label}</div>
                      <div className="text-base font-bold text-[var(--color-text)] mt-1">{k.value}</div>
                      <div className={`text-xs mt-1 ${k.up ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}>
                        {k.up ? '↑ 12%' : '↓ 3%'} vs mês ant.
                      </div>
                    </div>
                  ))}
                </div>
                {/* Chart mock bars */}
                <div className="bg-[var(--color-surface)] rounded-lg p-3 border border-[var(--color-border)]">
                  <div className="text-xs text-[var(--color-text-muted)] mb-3">Vendas — últimos 7 dias</div>
                  <div className="flex items-end gap-1.5 h-16">
                    {[40,65,30,80,55,90,70].map((h,i) => (
                      <div key={i} className="flex-1 rounded-sm bg-[var(--color-primary)]/60 transition-all"
                           style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Glow under */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-2/3 h-12 bg-[var(--color-primary)]/20 blur-2xl rounded-full" />
        </div>
      </div>
    </section>
  )
}
