const problems = [
  {
    icon: '🧩',
    title: 'Sistemas fragmentados',
    desc: 'ERP em um lugar, loja em outro, WhatsApp no celular, financeiro em planilha. Dados nunca batem e você perde horas cruzando informações.',
  },
  {
    icon: '📱',
    title: 'Sem experiência mobile',
    desc: 'Vendedor na rua, sem acesso ao estoque real. Gerente viajando, sem visão dos pedidos. Sistemas antigos travados no desktop.',
  },
  {
    icon: '🤖',
    title: 'IA desconectada do negócio',
    desc: 'ChatGPT aberto em outra aba, sem acesso aos seus dados reais. A IA não sabe seus produtos, seus clientes, nem seu estoque.',
  },
  {
    icon: '💸',
    title: 'Custo absurdo de integração',
    desc: 'Pagar por ERP + plataforma + integrações + suporte separados. Cada novo recurso exige um novo fornecedor, um novo contrato, uma nova dor de cabeça.',
  },
]

export default function Problems() {
  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-950/10 to-transparent pointer-events-none" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-red-950/30 border border-red-800/40 rounded-full px-4 py-1.5 mb-6">
            <span className="text-red-400 text-xs font-semibold uppercase tracking-widest">O problema</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            A realidade de quem{' '}
            <span className="text-red-400">ainda não usa</span>{' '}
            a Aura
          </h2>
          <p className="text-[var(--color-text-muted)] text-lg max-w-2xl mx-auto">
            Reconhece alguma dessas situações? A maioria das empresas convive com essas dores todo dia.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {problems.map((p, i) => (
            <div key={i}
                 className="glass rounded-xl p-6 border border-red-900/30 hover:border-red-700/50 transition-all group">
              <div className="w-12 h-12 rounded-lg bg-red-950/50 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                {p.icon}
              </div>
              <h3 className="font-heading font-bold text-lg text-[var(--color-text)] mb-2">{p.title}</h3>
              <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
