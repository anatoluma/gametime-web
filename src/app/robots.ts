import type { MetadataRoute } from 'next'

const siteUrl = 'https://ligabasket.md'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/login/'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}