const features = [
  {
    icon: '📊',
    title: 'Dashboard em tempo real',
    desc: 'MRR, pedidos, estoque crítico, atividade recente — tudo visível assim que você abre o sistema. KPIs que realmente importam para o seu negócio.',
    tag: 'ERP',
  },
  {
    icon: '👔',
    title: 'Grade de variações',
    desc: 'Cadastre produtos com grade completa (cor, tamanho, modelo). Controle de estoque por variação, foto por variante, preço diferenciado.',
    tag: 'ERP',
  },
  {
    icon: '📦',
    title: 'Gestão de estoque',
    desc: 'Entradas, saídas, transferências e alertas de estoque mínimo. Inventário sempre atualizado, sem discrepâncias entre loja e armazém.',
    tag: 'Estoque',
  },
  {
    icon: '🛒',
    title: 'Loja B2B integrada',
    desc: 'Catálogo online com seu domínio, tema e logo. Comprador faz pedido online, você aprova no ERP. Sem copiar pedido de WhatsApp para planilha.',
    tag: 'Store',
  },
  {
    icon: '🤖',
    title: 'WhatsApp Bot com IA',
    desc: 'Responde consultas de pedido, envia alertas de envio, notifica estoque baixo e faz atendimento inicial automaticamente via WhatsApp.',
    tag: 'IA',
  },
  {
    icon: '🎨',
    title: 'Tema por tenant',
    desc: 'Cada cliente tem sua identidade visual. Cor primária, tipografia, radius e modo dark/light configurável sem mexer em código.',
    tag: 'White-label',
  },
]

export default function Features() {
  return (
    <section id="features" className="py-24 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-purple-950/30 border border-purple-800/40 rounded-full px-4 py-1.5 mb-6">
            <span className="text-purple-400 text-xs font-semibold uppercase tracking-widest">Funcionalidades</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Tudo que você precisa,{' '}
            <span className="gradient-text">nada que não precisa</span>
          </h2>
          <p className="text-[var(--color-text-muted)] text-lg max-w-2xl mx-auto">
            Construído para empresas de moda, confecções, atacado e varejo. Sem customizações caras.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i}
                 className="glass rounded-xl p-6 border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 transition-all hover:-translate-y-1 group cursor-default">
              {/* Icon + Tag */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-[var(--color-surface)] flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <span className="text-xs bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 rounded-full px-2.5 py-0.5 font-medium">
                  {f.tag}
                </span>
              </div>
              <h3 className="font-heading font-bold text-base text-[var(--color-text)] mb-2">{f.title}</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
