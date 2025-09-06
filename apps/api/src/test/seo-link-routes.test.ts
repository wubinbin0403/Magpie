import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { testApp, mockLinks, mockSettings } from './helpers.js'

describe('SEO Link Routes (/link/:id)', () => {
  let app: any

  beforeEach(async () => {
    app = await testApp()
  })

  afterEach(() => {
    app?.cleanup?.()
  })

  describe('Bot User-Agent Detection', () => {
    const botUserAgents = [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Twitterbot/1.0',
      'LinkedInBot/1.0 (compatible; Mozilla/5.0)',
    ]

    it('should serve SEO HTML for bot user agents', async () => {
      for (const userAgent of botUserAgents) {
        const response = await app.request('/link/1', {
          headers: { 'User-Agent': userAgent }
        })

        expect(response.status).toBe(200)
        expect(response.headers.get('Content-Type')).toContain('text/html')
        
        const html = await response.text()
        expect(html).toContain('<!DOCTYPE html>')
        expect(html).toContain('<meta name="description"')
        expect(html).toContain('<meta property="og:title"')
        expect(html).toContain('<script type="application/ld+json"')
      }
    })

    it('should serve React SPA for regular user agents', async () => {
      const regularUserAgents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
      ]

      for (const userAgent of regularUserAgents) {
        const response = await app.request('/link/1', {
          headers: { 'User-Agent': userAgent }
        })

        expect(response.status).toBe(200)
        expect(response.headers.get('Content-Type')).toContain('text/html')
        
        const html = await response.text()
        // Should get development proxy HTML or production React app
        expect(html).toContain('<html')
      }
    })
  })

  describe('SEO HTML Generation for Bots', () => {
    const botUA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

    it('should generate SEO HTML for existing link', async () => {
      const response = await app.request('/link/1', {
        headers: { 'User-Agent': botUA }
      })

      expect(response.status).toBe(200)
      const html = await response.text()

      // Check basic HTML structure
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<html lang="zh-CN">')
      expect(html).toContain('<meta charset="UTF-8">')

      // Check SEO meta tags
      expect(html).toContain('<meta name="description"')
      expect(html).toContain('<meta property="og:title"')
      expect(html).toContain('<meta property="og:description"')
      expect(html).toContain('<meta property="og:type" content="article"')
      expect(html).toContain('<meta property="og:url" content="/link/1"')

      // Check Twitter Card tags
      expect(html).toContain('<meta name="twitter:card"')
      expect(html).toContain('<meta name="twitter:title"')
      expect(html).toContain('<meta name="twitter:description"')

      // Check canonical URL
      expect(html).toContain('<link rel="canonical" href="/link/1"')

      // Check JSON-LD structured data
      expect(html).toContain('<script type="application/ld+json">')
      expect(html).toContain('"@type": "WebPage"')
      expect(html).toContain('"@type": "Article"')

      // Check breadcrumb navigation
      expect(html).toContain('"@type": "BreadcrumbList"')
      expect(html).toContain('Home')
    })

    it('should include proper article metadata for published links', async () => {
      const response = await app.request('/link/1', {
        headers: { 'User-Agent': botUA }
      })

      const html = await response.text()
      
      // Check article-specific meta tags
      expect(html).toContain('<meta property="article:published_time"')
      expect(html).toContain('<meta property="article:section"')
      
      // Check structured data has article info
      expect(html).toContain('"datePublished"')
      expect(html).toContain('"author"')
      expect(html).toContain('"publisher"')
    })

    it('should handle links with tags in SEO HTML', async () => {
      const response = await app.request('/link/1', {
        headers: { 'User-Agent': botUA }
      })

      const html = await response.text()
      
      // Should include tags in structured data
      if (html.includes('"keywords"')) {
        expect(html).toMatch(/"keywords":\s*\[/)
      }
    })

    it('should fallback to homepage for non-existent link', async () => {
      const response = await app.request('/link/999999', {
        headers: { 'User-Agent': botUA }
      })

      expect(response.status).toBe(200)
      const html = await response.text()

      // Should fallback to general site HTML
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('Magpie')
    })
  })

  describe('Link ID Validation', () => {
    const botUA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

    it('should handle invalid link ID formats', async () => {
      const invalidIds = ['abc', '0', '-1', 'null', 'undefined']

      for (const id of invalidIds) {
        const response = await app.request(`/link/${id}`, {
          headers: { 'User-Agent': botUA }
        })

        expect(response.status).toBe(400)
        const html = await response.text()
        expect(html).toContain('Invalid Link ID')
      }
    })

    it('should handle very large link IDs', async () => {
      const response = await app.request('/link/999999999', {
        headers: { 'User-Agent': botUA }
      })

      expect(response.status).toBe(200) // Should not error, just return no results
      const html = await response.text()
      expect(html).toContain('<!DOCTYPE html>')
    })
  })

  describe('SEO Content Quality', () => {
    const botUA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

    it('should have proper page title format', async () => {
      const response = await app.request('/link/1', {
        headers: { 'User-Agent': botUA }
      })

      const html = await response.text()
      const titleMatch = html.match(/<title>([^<]+)<\/title>/)
      
      expect(titleMatch).toBeTruthy()
      if (titleMatch) {
        const title = titleMatch[1]
        // Should include both link title and site name
        expect(title).toMatch(/.*\s-\sMagpie$/)
      }
    })

    it('should include external link with proper attributes', async () => {
      const response = await app.request('/link/1', {
        headers: { 'User-Agent': botUA }
      })

      const html = await response.text()
      
      // Should have external link with security attributes
      expect(html).toContain('target="_blank"')
      expect(html).toContain('rel="noopener noreferrer"')
      expect(html).toContain('Visit Original Link')
    })

    it('should include navigation back to main site', async () => {
      const response = await app.request('/link/1', {
        headers: { 'User-Agent': botUA }
      })

      const html = await response.text()
      
      // Should have navigation elements
      expect(html).toContain('Browse All Links')
      expect(html).toMatch(/href="\/"/)
    })
  })

  describe('Performance and Caching', () => {
    const botUA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

    it('should respond quickly to bot requests', async () => {
      const startTime = Date.now()
      
      const response = await app.request('/link/1', {
        headers: { 'User-Agent': botUA }
      })

      const duration = Date.now() - startTime
      
      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(1000) // Should respond within 1 second
    })

    it('should handle concurrent bot requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) =>
        app.request(`/link/${i + 1}`, {
          headers: { 'User-Agent': botUA }
        })
      )

      const responses = await Promise.all(requests)
      
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })
  })
})