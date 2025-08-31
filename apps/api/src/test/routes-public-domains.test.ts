import { describe, it, expect, beforeEach } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { links } from '../db/schema.js'
import { createDomainsRouter } from '../routes/public/domains.js'

describe('Public Domains API', () => {
  let app: any

  beforeEach(async () => {
    clearTestData()
    
    // Use real router with test database injection
    app = createDomainsRouter(testDrizzle)
  })

  describe('GET /:domain/stats', () => {
    it('should return 404 for non-existent domain', async () => {
      const response = await app.request('/nonexistent.com/stats')
      const data = await response.json() as any

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 404 for domain with no published links', async () => {
      // Create test data with only pending links
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle
        .insert(links)
        .values({
          url: 'https://test.com/pending',
          domain: 'test.com',
          title: 'Pending Link',
          status: 'pending',
          createdAt: now,
        })

      const response = await app.request('/test.com/stats')
      const data = await response.json() as any

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return correct stats for domain with published links', async () => {
      const now = Math.floor(Date.now() / 1000)
      const earlier = now - 86400 // 1 day ago
      
      // Create test data
      await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/link1',
            domain: 'example.com',
            title: 'First Link',
            finalDescription: 'First description',
            finalCategory: 'tech',
            finalTags: JSON.stringify(['tag1']),
            status: 'published',
            publishedAt: earlier,
            createdAt: earlier,
          },
          {
            url: 'https://example.com/link2',
            domain: 'example.com',
            title: 'Latest Link',
            finalDescription: 'Latest description',
            finalCategory: 'tech',
            finalTags: JSON.stringify(['tag2']),
            status: 'published',
            publishedAt: now,
            createdAt: now,
          },
          {
            url: 'https://example.com/pending',
            domain: 'example.com',
            title: 'Pending Link',
            status: 'pending',
            createdAt: now,
          },
          {
            url: 'https://other.com/link',
            domain: 'other.com',
            title: 'Other Domain Link',
            status: 'published',
            publishedAt: now,
            createdAt: now,
          }
        ])

      const response = await app.request('/example.com/stats')
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual({
        domain: 'example.com',
        count: 2,
        latestPublished: new Date(now * 1000).toISOString(),
        latestTitle: 'Latest Link'
      })
    })

    it('should handle domain with special characters correctly', async () => {
      const now = Math.floor(Date.now() / 1000)
      
      // Create test data with domain containing special characters
      await testDrizzle
        .insert(links)
        .values({
          url: 'https://sub-domain.example-site.co.uk/path',
          domain: 'sub-domain.example-site.co.uk',
          title: 'Special Domain Link',
          finalDescription: 'Description',
          finalCategory: 'tech',
          finalTags: JSON.stringify(['test']),
          status: 'published',
          publishedAt: now,
          createdAt: now,
        })

      const response = await app.request('/sub-domain.example-site.co.uk/stats')
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.domain).toBe('sub-domain.example-site.co.uk')
      expect(data.data.count).toBe(1)
    })

    it('should return correct count for domain with multiple published links', async () => {
      const now = Math.floor(Date.now() / 1000)
      
      // Create 5 published links for the same domain
      const testLinks = Array.from({ length: 5 }, (_, i) => ({
        url: `https://github.com/repo${i}`,
        domain: 'github.com',
        title: `Repository ${i}`,
        finalDescription: `Description ${i}`,
        finalCategory: 'tech',
        finalTags: JSON.stringify([`tag${i}`]),
        status: 'published' as const,
        publishedAt: now - i * 3600, // Different times
        createdAt: now - i * 3600,
      }))

      await testDrizzle.insert(links).values(testLinks)

      const response = await app.request('/github.com/stats')
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.domain).toBe('github.com')
      expect(data.data.count).toBe(5)
      expect(data.data.latestTitle).toBe('Repository 0') // Most recent
    })

    it('should validate domain parameter', async () => {
      // Test with empty domain - Hono returns 404 for invalid routes
      const response = await app.request('//stats')
      expect(response.status).toBe(404)
    })

    it('should handle database errors gracefully', async () => {
      // Mock the database to throw an error
      const errorDb = {
        select: () => {
          throw new Error('Database connection failed')
        }
      }
      const errorApp = createDomainsRouter(errorDb as any)
      
      const response = await errorApp.request('/example.com/stats')
      const data = await response.json() as any

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INTERNAL_SERVER_ERROR')
    })
  })
})