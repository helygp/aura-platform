import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/cadastro/sucesso'] },
    sitemap: 'https://aurabr.app/sitemap.xml',
  }
}
