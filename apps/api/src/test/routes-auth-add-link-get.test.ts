import { describe, it, expect, beforeEach } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { apiTokens } from '../db/schema.js'
import { createAddLinkRouter } from '../routes/auth/add-link.js'
import crypto from 'crypto'

describe('Add Link GET API', () => {
  let app: any
  let adminToken: string

  beforeEach(async () => {
    clearTestData()

    // Use real router with test database injection
    app = createAddLinkRouter(testDrizzle)

    // Create admin token with proper format (mgp_ + 64 hex chars)
    const now = Math.floor(Date.now() / 1000)
    adminToken = 'mgp_' + crypto.randomBytes(32).toString('hex')
    await testDrizzle.insert(apiTokens).values({
      token: adminToken,
      name: 'Test Admin Token',
      prefix: 'mgp_',
      status: 'active',
      createdAt: now,
    })
  })

  describe('GET /add', () => {
    it('should require API token', async () => {
      const res = await app.request('/add?url=https://example.com')
      expect(res.status).toBe(401)
    })

    it('should require url parameter', async () => {
      const res = await app.request('/add', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })
      
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return HTML processing page for standard flow', async () => {
      const res = await app.request('/add?url=https://example.com/article', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })
      
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/html')
      
      const html = await res.text()
      expect(html).toContain('Processing')
      expect(html).toContain('https://example.com/article')
      expect(html).toContain('progress')
    })

    it('should return JSON for skipConfirm=true', async () => {
      const res = await app.request('/add?url=https://example.com/article&skipConfirm=true', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })
      
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('application/json')
      
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('id')
      expect(body.data).toHaveProperty('url')
      expect(body.data.status).toBe('published')
    })

    it('should handle custom category and tags', async () => {
      const res = await app.request('/add?url=https://example.com/tech&category=技术&tags=React,前端&skipConfirm=true', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })
      
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.category).toBe('技术')
      expect(body.data.tags).toContain('React')
      expect(body.data.tags).toContain('前端')
    })

    it('should return error for invalid URL', async () => {
      const res = await app.request('/add?url=invalid-url', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })
      
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return error for duplicate URL', async () => {
      const url = 'https://example.com/duplicate'
      
      // First request should succeed
      await app.request(`/add?url=${encodeURIComponent(url)}&skipConfirm=true`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })
      
      // Second request should fail
      const res = await app.request(`/add?url=${encodeURIComponent(url)}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })
      
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('DUPLICATE_URL')
    })
  })
})