import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Criar conta grátis — Aura Platform',
  description: 'Comece seu trial de 14 dias. Sem cartão de crédito. ERP + Loja B2B + WhatsApp Bot prontos em minutos.',
  robots: { index: false, follow: false },
}

export default function CadastroLayout({ children }: { children: React.ReactNode }) {
  return children
}
