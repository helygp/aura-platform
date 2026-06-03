const plans = [
  {
    id: 'starter',
    name: 'Starter',
    setup: '1.500',
    price: '297',
    period: '/mês',
    description: 'Para pequenas empresas começando a digitalizar.',
    highlight: false,
    features: [
      '5 usuários',
      '500 produtos',
      'ERP mobile-first',
      'Loja B2B própria',
      'WhatsApp Bot básico',
      '500 automações/mês',
      'Suporte por e-mail',
      '14 dias grátis',
    ],
    cta: 'Começar com Starter',
    ctaHref: '/cadastro?plano=starter',
  },
  {
    id: 'pro',
    name: 'Pro',
    setup: '1.500',
    price: '597',
    period: '/mês',
    description: 'Para empresas em crescimento que precisam de mais escala.',
    highlight: true,
    badge: 'Mais popular',
    features: [
      '15 usuários',
      '5.000 produtos',
      'Tudo do Starter',
      'WhatsApp Bot avançado',
      '2.000 automações/mês',
      'Relatórios avançados',
      'Tema white-label completo',
      'Suporte prioritário',
      '14 dias grátis',
    ],
    cta: 'Começar com Pro',
    ctaHref: '/cadastro?plano=pro',
  },
  {
    id: 'full',
    name: 'Full',
    setup: '1.500',
    price: '1.497',
    period: '/mês',
    description: 'Para empresas maiores com operação complexa.',
    highlight: false,
    features: [
      'Usuários ilimitados',
      'Produtos ilimitados',
      'Tudo do Pro',
      '10.000 automações/mês',
      'API pública',
      'SLA 99.9%',
      'Onboarding dedicado',
      'Suporte via WhatsApp',
      '14 dias grátis',
    ],
    cta: 'Começar com Full',
    ctaHref: '/cadastro?plano=full',
  },
]

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-950/10 to-transparent pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-4 py-1.5 mb-6">
            <span className="text-[var(--color-text-muted)] text-xs font-semibold uppercase tracking-widest">Planos</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Preço justo,{' '}
            <span className="gradient-text">sem surpresas</span>
          </h2>
          <p className="text-[var(--color-text-muted)] text-lg max-w-2xl mx-auto">
            Setup único de R$1.500 + mensalidade. Cancele quando quiser. Trial de 14 dias sem cartão.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => (
            <div key={plan.id}
                 className={`relative rounded-2xl p-6 border transition-all ${
                   plan.highlight
                     ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 shadow-[0_0_40px_rgba(2,132,199,0.2)]'
                     : 'glass border-[var(--color-border)]'
                 }`}>
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="gradient-cta text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Header */}
              <div className="mb-6">
                <h3 className="font-heading font-bold text-xl text-[var(--color-text)] mb-1">{plan.name}</h3>
                <p className="text-sm text-[var(--color-text-muted)]">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mb-1">
                <span className="text-xs text-[var(--color-text-muted)]">Setup R$ {plan.setup} +</span>
              </div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-sm text-[var(--color-text-muted)]">R$</span>
                <span className="text-4xl font-bold text-[var(--color-text)]">{plan.price}</span>
                <span className="text-[var(--color-text-muted)] text-sm">{plan.period}</span>
              </div>

              {/* CTA */}
              <a href={plan.ctaHref}
                 className={`block w-full text-center font-semibold py-3 rounded-lg text-sm mb-6 transition-all ${
                   plan.highlight
                     ? 'gradient-cta text-white hover:opacity-90 hover:scale-105'
                     : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                 }`}>
                {plan.cta}
              </a>

              {/* Features */}
              <ul className="space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                    <svg className="w-4 h-4 text-[var(--color-success)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-[var(--color-text-muted)] mt-8">
          Todos os planos incluem HTTPS automático, backups diários e atualizações sem custo adicional.
        </p>
      </div>
    </section>
  )
}
