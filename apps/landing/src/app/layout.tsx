import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Aura Platform — ERP + E-commerce + WhatsApp para o seu negócio',
  description: 'Plataforma SaaS white-label que integra ERP, loja B2B, automação WhatsApp e IA em um único sistema. Experimente 14 dias grátis.',
  keywords: 'ERP, e-commerce B2B, WhatsApp automação, SaaS, gestão empresarial, estoque, pedidos',
  authors: [{ name: 'Aura Cloud Solutions' }],
  openGraph: {
    title: 'Aura Platform — ERP + E-commerce + WhatsApp',
    description: 'Sistema integrado para gestão, vendas e atendimento. Do estoque ao cliente final, tudo em um lugar.',
    url: 'https://aurabr.app',
    siteName: 'Aura Platform',
    locale: 'pt_BR',
    type: 'website',
    images: [{ url: 'https://aurabr.app/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aura Platform — ERP + E-commerce + WhatsApp',
    description: 'Sistema integrado para gestão, vendas e atendimento.',
    images: ['https://aurabr.app/og-image.png'],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://aurabr.app' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark scroll-smooth">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className={`${inter.variable} font-body antialiased`}>
        {children}
      </body>
    </html>
  )
}
