export default function CTA() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-cta opacity-10 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[var(--color-primary)]/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <div className="glass rounded-3xl border border-[var(--color-primary)]/30 p-12 shadow-[0_0_60px_rgba(2,132,199,0.15)]">
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Pronto para{' '}
            <span className="gradient-text">transformar</span>{' '}
            seu negócio?
          </h2>
          <p className="text-[var(--color-text-muted)] text-lg mb-8 max-w-xl mx-auto">
            Em 5 minutos você tem ERP, loja B2B e WhatsApp Bot rodando.
            14 dias grátis, sem cartão, sem burocracia.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <a href="/cadastro"
               className="gradient-cta text-white font-bold text-base px-10 py-4 rounded-xl hover:opacity-90 transition-all hover:scale-105 shadow-lg">
              Criar minha conta grátis ✨
            </a>
            <a href="https://wa.me/5511999999999?text=Olá, quero saber mais sobre a Aura Platform"
               target="_blank" rel="noopener noreferrer"
               className="bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] font-semibold text-base px-10 py-4 rounded-xl hover:bg-[var(--color-surface-hover)] transition-all flex items-center justify-center gap-2">
              <span>💬</span> Falar com vendas
            </a>
          </div>

          <div className="flex items-center justify-center gap-6 text-xs text-[var(--color-text-muted)]">
            {['14 dias grátis', 'Sem cartão', 'Cancele quando quiser', 'Suporte em português'].map(item => (
              <span key={item} className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
