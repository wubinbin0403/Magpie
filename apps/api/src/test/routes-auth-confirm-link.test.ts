import { describe, it, expect, beforeEach } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { links, apiTokens } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { createConfirmLinkRouter } from '../routes/auth/confirm-link.js'
import type { ConfirmLinkResponse } from '../types/api.js'

describe('Auth Confirm Link API', () => {
  let app: any
  let testToken: string

  beforeEach(async () => {
    clearTestData()
    
    // Use real router with test database injection
    app = createConfirmLinkRouter(testDrizzle)
    
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

  describe('POST /:id/confirm', () => {
    it('should require authentication', async () => {
      const response = await app.request('/1/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: 'Test description',
          category: 'test',
          tags: ['test']
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('AUTH_REQUIRED')
    })

    it('should return 404 for non-existent link', async () => {
      const response = await app.request('/99999/confirm', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: 'Test description',
          category: 'test',
          tags: ['test']
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should confirm and publish a pending link', async () => {
      // Create a pending link
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/pending',
          domain: 'example.com',
          title: 'Pending Article',
          originalDescription: 'Original description',
          aiSummary: 'AI generated summary',
          aiCategory: 'technology',
          aiTags: JSON.stringify(['ai', 'tech']),
          status: 'pending',
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = linkResult[0].id

      const confirmData = {
        title: 'Updated Title',
        description: 'User confirmed description',
        category: 'programming',
        tags: ['react', 'javascript'],
        publish: true
      }

      const response = await app.request(`/${linkId}/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(confirmData)
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveProperty('id', linkId)
      expect(data.data).toHaveProperty('status', 'published')
      expect(data.data).toHaveProperty('publishedAt')

      // Verify in database
      const dbLink = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.id, linkId))
        .limit(1)

      expect(dbLink[0].status).toBe('published')
      expect(dbLink[0].userDescription).toBe('User confirmed description')
      expect(dbLink[0].userCategory).toBe('programming')
      expect(JSON.parse(dbLink[0].userTags)).toEqual(['react', 'javascript'])
      expect(dbLink[0].title).toBe('Updated Title') // Title should be updated
      expect(dbLink[0].publishedAt).toBeTruthy()
    })

    it('should save as draft when publish=false', async () => {
      // Create a pending link
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/draft',
          domain: 'example.com',
          title: 'Draft Article',
          aiSummary: 'AI summary',
          aiCategory: 'general',
          aiTags: JSON.stringify(['draft']),
          status: 'pending',
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = linkResult[0].id

      const confirmData = {
        description: 'Draft description',
        category: 'general',
        tags: ['draft'],
        publish: false
      }

      const response = await app.request(`/${linkId}/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(confirmData)
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveProperty('status', 'draft')
      expect(data.data).not.toHaveProperty('publishedAt')

      // Verify in database
      const dbLink = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.id, linkId))
        .limit(1)

      expect(dbLink[0].status).toBe('draft')
      expect(dbLink[0].publishedAt).toBeNull()
    })

    it('should reject access to already published links', async () => {
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

      const response = await app.request(`/${linkId}/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: 'New description',
          category: 'test',
          tags: ['test']
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_STATUS')
    })

    it('should validate required fields', async () => {
      // Create a pending link
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/validation',
          domain: 'example.com',
          title: 'Validation Test',
          status: 'pending',
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = linkResult[0].id

      // Missing required description
      const response = await app.request(`/${linkId}/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          category: 'test',
          tags: ['test']
          // description is missing
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should use AI values as defaults when user values not provided', async () => {
      // Create a pending link with AI values
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/ai-defaults',
          domain: 'example.com',
          title: 'AI Defaults Test',
          aiSummary: 'AI generated summary',
          aiCategory: 'ai-category',
          aiTags: JSON.stringify(['ai', 'defaults']),
          status: 'pending',
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = linkResult[0].id

      const confirmData = {
        description: 'User description',
        // category and tags not provided - should use AI values
        publish: true
      }

      const response = await app.request(`/${linkId}/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(confirmData)
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)

      // Verify in database - should use AI values for category and tags
      const dbLink = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.id, linkId))
        .limit(1)

      expect(dbLink[0].userDescription).toBe('User description')
      expect(dbLink[0].userCategory || dbLink[0].aiCategory).toBe('ai-category') // AI value used
      const tags = dbLink[0].userTags ? JSON.parse(dbLink[0].userTags) : JSON.parse(dbLink[0].aiTags)
      expect(tags).toEqual(['ai', 'defaults']) // AI values used
    })
  })
})