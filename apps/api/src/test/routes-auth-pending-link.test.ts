import { describe, it, expect, beforeEach } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { links, apiTokens } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { createPendingLinkRouter } from '../routes/auth/pending-link.js'
import type { PendingLinkResponse } from '../types/api.js'

describe('Auth Pending Link API', () => {
  let app: any
  let testToken: string

  beforeEach(async () => {
    clearTestData()
    
    // Use real router with test database injection
    app = createPendingLinkRouter(testDrizzle)
    
    // Create test API token
    const tokenResult = await testDrizzle
      .insert(apiTokens)
      .values({
        token: 'mgp_' + '0'.repeat(64), // Valid format test token
        name: 'Test Token',
        status: 'active',
        usageCount: 0,
        createdAt: Math.floor(Date.now() / 1000)
      })
      .returning({ token: apiTokens.token })
    
    testToken = tokenResult[0].token
  })

  describe('GET /:id/pending', () => {
    it('should require authentication', async () => {
      const response = await app.request('/1/pending')
      const data = await response.json() as any

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('AUTH_REQUIRED')
    })

    it('should return 404 for non-existent link', async () => {
      const response = await app.request('/99999/pending', {
        headers: {
          'Authorization': `Bearer ${testToken}`
        }
      })
      const data = await response.json() as any

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return pending link details', async () => {
      // Create a pending link
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/pending',
          domain: 'example.com',
          title: 'Pending Article',
          originalDescription: 'Original description from webpage',
          aiSummary: 'AI generated summary',
          aiCategory: 'technology',
          aiTags: JSON.stringify(['ai', 'tech']),
          userDescription: 'User edited description',
          userCategory: 'programming',
          userTags: JSON.stringify(['react', 'javascript']),
          status: 'pending',
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = linkResult[0].id

      const response = await app.request(`/${linkId}/pending`, {
        headers: {
          'Authorization': `Bearer ${testToken}`
        }
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      const linkData = data.data
      expect(linkData).toHaveProperty('id', linkId)
      expect(linkData).toHaveProperty('url', 'https://example.com/pending')
      expect(linkData).toHaveProperty('title', 'Pending Article')
      expect(linkData).toHaveProperty('originalDescription', 'Original description from webpage')
      expect(linkData).toHaveProperty('aiSummary', 'AI generated summary')
      expect(linkData).toHaveProperty('aiCategory', 'technology')
      expect(linkData).toHaveProperty('aiTags')
      expect(linkData.aiTags).toEqual(['ai', 'tech'])
      expect(linkData).toHaveProperty('domain', 'example.com')
      expect(linkData).toHaveProperty('createdAt')
      
      // User editable fields
      expect(linkData).toHaveProperty('userDescription', 'User edited description')
      expect(linkData).toHaveProperty('userCategory', 'programming')
      expect(linkData).toHaveProperty('userTags')
      expect(linkData.userTags).toEqual(['react', 'javascript'])
    })

    it('should handle pending link with no user edits', async () => {
      // Create a pending link without user edits
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/no-edits',
          domain: 'example.com',
          title: 'Article Without Edits',
          originalDescription: 'Original description',
          aiSummary: 'AI summary',
          aiCategory: 'general',
          aiTags: JSON.stringify(['article']),
          userDescription: null,
          userCategory: null,
          userTags: null,
          status: 'pending',
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = linkResult[0].id

      const response = await app.request(`/${linkId}/pending`, {
        headers: {
          'Authorization': `Bearer ${testToken}`
        }
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      const linkData = data.data
      // For fields with null values, they should not be present in JSON response
      expect(linkData).not.toHaveProperty('userDescription')
      expect(linkData).not.toHaveProperty('userCategory')
      expect(linkData).not.toHaveProperty('userTags')
    })

    it('should reject access to published links', async () => {
      // Create a published link
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/published',
          domain: 'example.com',
          title: 'Published Article',
          userDescription: 'Final description',
          userCategory: 'technology',
          userTags: JSON.stringify(['tech']),
          status: 'published',
          publishedAt: now,
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = linkResult[0].id

      const response = await app.request(`/${linkId}/pending`, {
        headers: {
          'Authorization': `Bearer ${testToken}`
        }
      })
      const data = await response.json() as any

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_STATUS')
    })

    it('should reject access to deleted links', async () => {
      // Create a deleted link
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/deleted',
          domain: 'example.com',
          title: 'Deleted Article',
          status: 'deleted',
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = linkResult[0].id

      const response = await app.request(`/${linkId}/pending`, {
        headers: {
          'Authorization': `Bearer ${testToken}`
        }
      })
      const data = await response.json() as any

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_STATUS')
    })

    it('should validate link ID parameter', async () => {
      const response = await app.request('/invalid-id/pending', {
        headers: {
          'Authorization': `Bearer ${testToken}`
        }
      })
      const data = await response.json() as any

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })
})