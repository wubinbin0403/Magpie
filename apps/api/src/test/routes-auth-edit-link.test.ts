import { describe, it, expect, beforeEach } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { links, apiTokens } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { createEditLinkRouter } from '../routes/auth/edit-link.js'

describe('Auth Edit Link API', () => {
  let app: any
  let testToken: string

  beforeEach(async () => {
    clearTestData()
    
    // Use real router with test database injection
    app = createEditLinkRouter(testDrizzle)
    
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

  describe('PUT /:id', () => {
    it('should require authentication', async () => {
      const response = await app.request('/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Updated Title'
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('AUTH_REQUIRED')
    })

    it('should return 404 for non-existent link', async () => {
      const response = await app.request('/99999', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Updated Title'
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should update a pending link', async () => {
      // Create a pending link
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/pending',
          domain: 'example.com',
          title: 'Original Title',
          originalDescription: 'Original description',
          aiSummary: 'AI summary',
          aiCategory: 'ai-category',
          aiTags: JSON.stringify(['ai-tag']),
          status: 'pending',
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = linkResult[0].id

      const updateData = {
        title: 'Updated Title',
        description: 'Updated description',
        category: 'updated-category',
        tags: ['updated-tag1', 'updated-tag2']
      }

      const response = await app.request(`/${linkId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify link is updated in database
      const dbLink = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.id, linkId))
        .limit(1)

      expect(dbLink[0].title).toBe('Updated Title')
      expect(dbLink[0].userDescription).toBe('Updated description')
      expect(dbLink[0].userCategory).toBe('updated-category')
      expect(JSON.parse(dbLink[0].userTags || '[]')).toEqual(['updated-tag1', 'updated-tag2'])
      expect(dbLink[0].updatedAt).toBeGreaterThanOrEqual(now)
    })

    it('should update a published link', async () => {
      // Create a published link
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/published',
          domain: 'example.com',
          title: 'Original Title',
          userDescription: 'Final description',
          userCategory: 'original-category',
          userTags: JSON.stringify(['original-tag']),
          status: 'published',
          publishedAt: now,
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = linkResult[0].id

      const updateData = {
        title: 'Updated Title',
        description: 'Updated description',
        category: 'updated-category',
        tags: ['updated-tag']
      }

      const response = await app.request(`/${linkId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify link is updated in database with final values
      const dbLink = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.id, linkId))
        .limit(1)

      expect(dbLink[0].title).toBe('Updated Title')
      expect(dbLink[0].userDescription).toBe('Updated description')
      expect(dbLink[0].userCategory).toBe('updated-category')
      expect(JSON.parse(dbLink[0].userTags || '[]')).toEqual(['updated-tag'])
      expect(dbLink[0].updatedAt).toBeGreaterThanOrEqual(now)
    })

    it('should not update a deleted link', async () => {
      // Create a deleted link
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/deleted',
          domain: 'example.com',
          title: 'Deleted Title',
          status: 'deleted',
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = linkResult[0].id

      const response = await app.request(`/${linkId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Updated Title'
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('ALREADY_DELETED')
    })

    it('should allow partial updates', async () => {
      // Create a pending link
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/partial',
          domain: 'example.com',
          title: 'Original Title',
          originalDescription: 'Original description',
          aiSummary: 'AI summary',
          aiCategory: 'ai-category',
          aiTags: JSON.stringify(['ai-tag']),
          status: 'pending',
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = linkResult[0].id

      // Update only title
      const response = await app.request(`/${linkId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Only Title Updated'
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify only title is updated
      const dbLink = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.id, linkId))
        .limit(1)

      expect(dbLink[0].title).toBe('Only Title Updated')
      expect(dbLink[0].originalDescription).toBe('Original description')
      expect(dbLink[0].aiSummary).toBe('AI summary')
      expect(dbLink[0].aiCategory).toBe('ai-category')
    })

    it('should allow status change', async () => {
      // Create a pending link
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/status-change',
          domain: 'example.com',
          title: 'Status Change Link',
          originalDescription: 'Original description',
          aiSummary: 'AI summary',
          aiCategory: 'ai-category',
          aiTags: JSON.stringify(['ai-tag']),
          status: 'pending',
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = linkResult[0].id

      // Change status to published
      const response = await app.request(`/${linkId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'published',
          description: 'Final description',
          category: 'final-category',
          tags: ['final-tag']
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify status is updated and final fields are set
      const dbLink = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.id, linkId))
        .limit(1)

      expect(dbLink[0].status).toBe('published')
      expect(dbLink[0].userDescription).toBe('Final description')
      expect(dbLink[0].userCategory).toBe('final-category')
      expect(JSON.parse(dbLink[0].userTags || '[]')).toEqual(['final-tag'])
      expect(dbLink[0].publishedAt).toBeGreaterThanOrEqual(now)
    })

    it('should validate request data', async () => {
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

      // Test invalid data
      const response = await app.request(`/${linkId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'invalid-status',
          tags: 'not-an-array'
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should validate ID parameter', async () => {
      const response = await app.request('/invalid-id', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Updated Title'
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })
})