'use client'
import { useState } from 'react'

const faqs = [
  {
    q: 'Preciso de cartão de crédito para o trial?',
    a: 'Não. O trial de 14 dias é completamente gratuito e sem cartão. Você preenche o formulário, recebe as credenciais e começa a usar imediatamente. Só cobramos ao fim do trial se você decidir continuar.',
  },
  {
    q: 'Quanto tempo leva para ter meu sistema rodando?',
    a: 'Após preencher o formulário de cadastro, seu ERP, loja B2B e API ficam provisionados automaticamente em menos de 5 minutos. Você recebe um e-mail com todas as credenciais e URLs.',
  },
  {
    q: 'Posso usar meu próprio domínio?',
    a: 'Sim. Por padrão criamos um subdomínio em aurabr.app (ex: suaempresa.aurabr.app). Mas você pode apontar seu próprio domínio — a configuração é simples e documentada.',
  },
  {
    q: 'Como funciona o white-label?',
    a: 'Toda a plataforma fica com a sua marca: logo, cores, tipografia, nome. Seus clientes verão apenas sua identidade visual, sem mencionar Aura. Inclusive o domínio pode ser o seu.',
  },
  {
    q: 'Meus dados ficam isolados de outros clientes?',
    a: 'Sim, 100%. Cada empresa tem seu próprio banco de dados isolado. Não há compartilhamento de dados entre tenants. Somos LGPD compliant e os dados ficam em servidores no Brasil.',
  },
  {
    q: 'Posso cancelar a qualquer momento?',
    a: 'Sim. Não há fidelidade. Você pode cancelar quando quiser pelo painel de billing. Seus dados ficam disponíveis para exportação por 30 dias após o cancelamento.',
  },
  {
    q: 'O plano inclui suporte para configurar o WhatsApp Bot?',
    a: 'O Starter inclui suporte por e-mail com documentação passo a passo. O Pro e Full incluem suporte prioritário e auxiliamos na configuração inicial do bot sem custo adicional.',
  },
  {
    q: 'É possível migrar dados do meu sistema atual?',
    a: 'Sim. Oferecemos importação via planilha para produtos, clientes e estoque inicial. Para migrações mais complexas, nosso time pode auxiliar — entre em contato antes de contratar.',
  },
]

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section id="faq" className="py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-4 py-1.5 mb-6">
            <span className="text-[var(--color-text-muted)] text-xs font-semibold uppercase tracking-widest">FAQ</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Perguntas{' '}
            <span className="gradient-text">frequentes</span>
          </h2>
          <p className="text-[var(--color-text-muted)] text-lg">Tire suas dúvidas antes de começar.</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i}
                 className={`glass rounded-xl border transition-all ${
                   open === i ? 'border-[var(--color-primary)]/40' : 'border-[var(--color-border)]'
                 }`}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left gap-4">
                <span className="font-medium text-[var(--color-text)] text-sm">{faq.q}</span>
                <svg
                  className={`w-5 h-5 text-[var(--color-primary)] shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {open === i && (
                <div className="px-6 pb-5">
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
