import { describe, it, expect, beforeEach } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { links, apiTokens } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { createDeleteLinkRouter } from '../routes/auth/delete-link.js'
import type { DeleteLinkResponse } from '@magpie/shared'

describe('Auth Delete Link API', () => {
  let app: any
  let testToken: string

  beforeEach(async () => {
    clearTestData()
    
    // Use real router with test database injection
    app = createDeleteLinkRouter(testDrizzle)
    
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

  describe('DELETE /:id', () => {
    it('should require authentication', async () => {
      const response = await app.request('/1', {
        method: 'DELETE'
      })
      const data = await response.json() as any

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('AUTH_REQUIRED')
    })

    it('should return 404 for non-existent link', async () => {
      const response = await app.request('/99999', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${testToken}`
        }
      })
      const data = await response.json() as any

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should delete a pending link', async () => {
      // Create a pending link
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/pending-delete',
          domain: 'example.com',
          title: 'Link To Delete',
          status: 'pending',
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = linkResult[0].id

      const response = await app.request(`/${linkId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${testToken}`
        }
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('deleted successfully')

      // Verify link is marked as deleted in database
      const dbLink = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.id, linkId))
        .limit(1)

      expect(dbLink[0].status).toBe('deleted')
    })

    it('should delete a published link', async () => {
      // Create a published link
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/published-delete',
          domain: 'example.com',
          title: 'Published Link To Delete',
          userDescription: 'Final description',
          userCategory: 'test',
          userTags: JSON.stringify(['test']),
          status: 'published',
          publishedAt: now,
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = linkResult[0].id

      const response = await app.request(`/${linkId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${testToken}`
        }
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify link is marked as deleted
      const dbLink = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.id, linkId))
        .limit(1)

      expect(dbLink[0].status).toBe('deleted')
    })

    it('should delete a draft link', async () => {
      // Create a draft link
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/draft-delete',
          domain: 'example.com',
          title: 'Draft Link To Delete',
          status: 'draft',
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = linkResult[0].id

      const response = await app.request(`/${linkId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${testToken}`
        }
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify link is marked as deleted
      const dbLink = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.id, linkId))
        .limit(1)

      expect(dbLink[0].status).toBe('deleted')
    })

    it('should not delete an already deleted link', async () => {
      // Create a deleted link
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/already-deleted',
          domain: 'example.com',
          title: 'Already Deleted Link',
          status: 'deleted',
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = linkResult[0].id

      const response = await app.request(`/${linkId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${testToken}`
        }
      })
      const data = await response.json() as any

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('ALREADY_DELETED')
    })

    it('should validate link ID parameter', async () => {
      const response = await app.request('/invalid-id', {
        method: 'DELETE',
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