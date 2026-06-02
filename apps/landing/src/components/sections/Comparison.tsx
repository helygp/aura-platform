type CheckValue = boolean | string

const rows: { feature: string; aura: CheckValue; bling: CheckValue; nuvem: CheckValue }[] = [
  { feature: 'ERP completo',                    aura: true,         bling: true,          nuvem: false },
  { feature: 'Loja B2B integrada',              aura: true,         bling: false,         nuvem: 'B2C apenas' },
  { feature: 'Mobile-first nativo',             aura: true,         bling: 'Parcial',     nuvem: true },
  { feature: 'WhatsApp Bot com IA',             aura: true,         bling: false,         nuvem: false },
  { feature: 'White-label / marca própria',     aura: true,         bling: false,         nuvem: 'Pago extra' },
  { feature: 'Multi-tenant SaaS',               aura: true,         bling: false,         nuvem: false },
  { feature: 'Grade de variações',              aura: true,         bling: true,          nuvem: true },
  { feature: 'Gestão de estoque avançada',      aura: true,         bling: true,          nuvem: 'Básica' },
  { feature: 'Painel financeiro + assinatura',  aura: true,         bling: 'Pago extra',  nuvem: false },
  { feature: 'Trial 14 dias sem cartão',        aura: true,         bling: false,         nuvem: true },
  { feature: 'Suporte em português',            aura: true,         bling: true,          nuvem: true },
  { feature: 'Setup e onboarding inclusos',     aura: true,         bling: false,         nuvem: false },
]

function Cell({ value }: { value: CheckValue }) {
  if (value === true) {
    return <span className="text-[var(--color-success)] text-lg">✓</span>
  }
  if (value === false) {
    return <span className="text-[var(--color-text-disabled)] text-lg">—</span>
  }
  return <span className="text-[var(--color-warning)] text-xs font-medium">{value}</span>
}

export default function Comparison() {
  return (
    <section id="comparativo" className="py-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-4 py-1.5 mb-6">
            <span className="text-[var(--color-text-muted)] text-xs font-semibold uppercase tracking-widest">Comparativo</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Aura vs{' '}
            <span className="gradient-text">concorrentes</span>
          </h2>
          <p className="text-[var(--color-text-muted)] text-lg max-w-xl mx-auto">
            Veja por que empresas estão migrando para a Aura.
          </p>
        </div>

        <div className="glass rounded-2xl border border-[var(--color-border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="py-4 px-6 text-left text-[var(--color-text-muted)] font-medium">Funcionalidade</th>
                  <th className="py-4 px-4 text-center min-w-[120px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="gradient-text font-bold text-base">Aura</span>
                      <span className="text-xs text-[var(--color-text-muted)]">R$ 297/mês</span>
                    </div>
                  </th>
                  <th className="py-4 px-4 text-center min-w-[100px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[var(--color-text)] font-semibold">Bling</span>
                      <span className="text-xs text-[var(--color-text-muted)]">R$ 149/mês</span>
                    </div>
                  </th>
                  <th className="py-4 px-4 text-center min-w-[100px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[var(--color-text)] font-semibold">Nuvemshop</span>
                      <span className="text-xs text-[var(--color-text-muted)]">R$ 199/mês</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}
                      className={`border-b border-[var(--color-border)]/50 transition-colors hover:bg-[var(--color-surface)]/40 ${
                        i % 2 === 0 ? '' : 'bg-[var(--color-surface)]/20'
                      }`}>
                    <td className="py-3.5 px-6 text-[var(--color-text-muted)]">{row.feature}</td>
                    <td className="py-3.5 px-4 text-center bg-[var(--color-primary)]/5">
                      <Cell value={row.aura} />
                    </td>
                    <td className="py-3.5 px-4 text-center"><Cell value={row.bling} /></td>
                    <td className="py-3.5 px-4 text-center"><Cell value={row.nuvem} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--color-text-muted)] mt-4">
          * Comparativo baseado nos planos mais próximos de cada plataforma. Preços sujeitos a alteração.
        </p>
      </div>
    </section>
  )
}
