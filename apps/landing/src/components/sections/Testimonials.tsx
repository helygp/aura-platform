const testimonials = [
  {
    name: 'Rodrigo Mendes',
    role: 'Sócio-diretor, Atacado Mendes & Filhos',
    avatar: 'RM',
    color: 'bg-blue-600',
    stars: 5,
    text: 'Antes usávamos 3 sistemas diferentes mais planilha. Agora tudo fica na Aura. A loja B2B reduziu em 70% as ligações de clientes para tirar pedido. Implantamos em 2 dias.',
  },
  {
    name: 'Camila Soares',
    role: 'Gestora de Operações, Confecção CS',
    avatar: 'CS',
    color: 'bg-purple-600',
    stars: 5,
    text: 'O controle de grade de variações salvou nossa operação. Sabemos exatamente quantas peças de cada cor e tamanho temos. O WhatsApp Bot responde nossos clientes fora do horário comercial.',
  },
  {
    name: 'Fábio Lima',
    role: 'CEO, Distribuidora Lima',
    avatar: 'FL',
    color: 'bg-emerald-600',
    stars: 5,
    text: 'Sistema mobile-first é diferencial para equipe de vendas externos. Eles consultam estoque em tempo real e fazem pedido direto pelo celular. Migrei do ERP antigo sem perder dados.',
  },
]

export default function Testimonials() {
  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-950/10 to-transparent pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-emerald-950/30 border border-emerald-800/40 rounded-full px-4 py-1.5 mb-6">
            <span className="text-emerald-400 text-xs font-semibold uppercase tracking-widest">Depoimentos</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Quem já{' '}
            <span className="text-emerald-400">transformou</span>{' '}
            o negócio
          </h2>
          <p className="text-[var(--color-text-muted)] text-lg max-w-xl mx-auto">
            Empresas reais usando a Aura no dia a dia.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i}
                 className="glass rounded-xl p-6 border border-[var(--color-border)] hover:border-emerald-800/40 transition-all hover:-translate-y-1">
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.stars }).map((_, s) => (
                  <span key={s} className="text-yellow-400 text-sm">★</span>
                ))}
              </div>

              {/* Quote */}
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-6 italic">
                &ldquo;{t.text}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--color-text)]">{t.name}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
