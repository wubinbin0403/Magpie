import { describe, it, expect, beforeEach } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { links, users } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { createAdminBatchRouter } from '../routes/admin/batch.js'
import { hashPassword, createAdminJWT } from '../utils/auth.js'

describe('Admin Batch Operations API (/api/admin/pending/batch)', () => {
  let app: any
  let adminToken: string

  beforeEach(async () => {
    clearTestData()
    
    // Use real router with test database injection
    app = createAdminBatchRouter(testDrizzle)
    
    // Create admin user and token
    const { hash, salt } = await hashPassword('admin123')
    const now = Math.floor(Date.now() / 1000)
    
    const adminResult = await testDrizzle
      .insert(users)
      .values({
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: hash,
        salt: salt,
        role: 'admin',
        status: 'active',
        createdAt: now,
      })
      .returning({ id: users.id })

    adminToken = createAdminJWT({
      userId: adminResult[0].id,
      username: 'admin',
      role: 'admin'
    })
  })

  describe('POST /batch', () => {
    it('should require admin authentication', async () => {
      const response = await app.request('/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ids: [1, 2],
          action: 'confirm'
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })

    it('should confirm multiple pending links', async () => {
      // Create pending links
      const now = Math.floor(Date.now() / 1000)
      const linkResults = await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/link1',
            domain: 'example.com',
            title: 'Link 1',
            originalDescription: 'Description 1',
            aiSummary: 'Summary 1',
            aiCategory: 'tech',
            aiTags: JSON.stringify(['tag1']),
            status: 'pending',
            createdAt: now,
          },
          {
            url: 'https://example.com/link2',
            domain: 'example.com',
            title: 'Link 2',
            originalDescription: 'Description 2',
            aiSummary: 'Summary 2',
            aiCategory: 'art',
            aiTags: JSON.stringify(['tag2']),
            status: 'pending',
            createdAt: now,
          }
        ])
        .returning({ id: links.id })

      const linkIds = linkResults.map(r => r.id)

      const response = await app.request('/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ids: linkIds,
          action: 'confirm',
          params: {
            category: 'batch-category',
            tags: ['batch-tag1', 'batch-tag2']
          }
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.processed).toBe(2)
      expect(data.data.results).toHaveLength(2)

      // Verify links are published with batch params
      for (const linkId of linkIds) {
        const dbLink = await testDrizzle
          .select()
          .from(links)
          .where(eq(links.id, linkId))
          .limit(1)

        expect(dbLink[0].status).toBe('published')
        expect(dbLink[0].userCategory).toBe('batch-category')
        expect(JSON.parse(dbLink[0].userTags || '[]')).toEqual(['batch-tag1', 'batch-tag2'])
        expect(dbLink[0].publishedAt).toBeGreaterThanOrEqual(now)
      }
    })

    it('should delete multiple links', async () => {
      // Create links to delete
      const now = Math.floor(Date.now() / 1000)
      const linkResults = await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/delete1',
            domain: 'example.com',
            title: 'Delete 1',
            status: 'pending',
            createdAt: now,
          },
          {
            url: 'https://example.com/delete2',
            domain: 'example.com',
            title: 'Delete 2',
            status: 'published',
            publishedAt: now,
            createdAt: now,
          }
        ])
        .returning({ id: links.id })

      const linkIds = linkResults.map(r => r.id)

      const response = await app.request('/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ids: linkIds,
          action: 'delete'
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.processed).toBe(2)

      // Verify links are marked as deleted
      for (const linkId of linkIds) {
        const dbLink = await testDrizzle
          .select()
          .from(links)
          .where(eq(links.id, linkId))
          .limit(1)

        expect(dbLink[0].status).toBe('deleted')
      }
    })

    it('should reanalyze multiple links (placeholder)', async () => {
      // Create pending links
      const now = Math.floor(Date.now() / 1000)
      const linkResults = await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/reanalyze1',
            domain: 'example.com',
            title: 'Reanalyze 1',
            originalDescription: 'Old description 1',
            aiSummary: 'Old summary 1',
            aiCategory: 'old-category',
            aiTags: JSON.stringify(['old-tag']),
            status: 'pending',
            createdAt: now,
          }
        ])
        .returning({ id: links.id })

      const linkIds = linkResults.map(r => r.id)

      const response = await app.request('/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ids: linkIds,
          action: 'reanalyze'
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.processed).toBe(1)
      expect(data.message).toContain('reanalysis queued')
    })

    it('should handle mixed success and failure', async () => {
      // Create one pending link and reference a non-existent one
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/exists',
          domain: 'example.com',
          title: 'Exists',
          status: 'pending',
          createdAt: now,
        })
        .returning({ id: links.id })

      const validId = linkResult[0].id
      const invalidId = 99999

      const response = await app.request('/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ids: [validId, invalidId],
          action: 'delete'
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.processed).toBe(1)
      expect(data.data.failed).toBe(1)
      expect(data.data.results).toHaveLength(2)
      
      // Should have one success and one failure
      const results = data.data.results
      expect(results.some((r: any) => r.success === true)).toBe(true)
      expect(results.some((r: any) => r.success === false)).toBe(true)
    })

    it('should validate request data', async () => {
      // Test invalid action
      const response1 = await app.request('/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ids: [1, 2],
          action: 'invalid-action'
        })
      })
      const data1 = await response1.json() as any

      expect(response1.status).toBe(400)
      expect(data1.success).toBe(false)

      // Test empty ids
      const response2 = await app.request('/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ids: [],
          action: 'confirm'
        })
      })
      const data2 = await response2.json() as any

      expect(response2.status).toBe(400)
      expect(data2.success).toBe(false)

      // Test too many ids
      const tooManyIds = Array.from({ length: 101 }, (_, i) => i + 1)
      const response3 = await app.request('/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ids: tooManyIds,
          action: 'confirm'
        })
      })
      const data3 = await response3.json() as any

      expect(response3.status).toBe(400)
      expect(data3.success).toBe(false)
    })

    it('should not process already deleted links for confirm action', async () => {
      // Create a deleted link
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/deleted',
          domain: 'example.com',
          title: 'Deleted Link',
          status: 'deleted',
          createdAt: now,
        })
        .returning({ id: links.id })

      const response = await app.request('/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ids: [linkResult[0].id],
          action: 'confirm'
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.processed).toBe(0)
      expect(data.data.skipped).toBe(1)
    })

    it('should preserve AI analysis data when confirming without params', async () => {
      // Create pending links with AI analysis data
      const now = Math.floor(Date.now() / 1000)
      const linkResults = await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/ai-preserved1',
            domain: 'example.com',
            title: 'AI Preserved Link 1',
            originalDescription: 'Original description 1',
            aiSummary: 'AI generated summary 1',
            aiCategory: 'AI-category-1',
            aiTags: JSON.stringify(['ai-tag1', 'ai-tag2']),
            status: 'pending',
            createdAt: now,
          },
          {
            url: 'https://example.com/ai-preserved2',
            domain: 'example.com',
            title: 'AI Preserved Link 2',
            originalDescription: 'Original description 2',
            aiSummary: 'AI generated summary 2',
            aiCategory: 'AI-category-2',
            aiTags: JSON.stringify(['ai-tag3', 'ai-tag4']),
            status: 'pending',
            createdAt: now,
          }
        ])
        .returning({ id: links.id })

      const linkIds = linkResults.map(r => r.id)

      // Confirm without providing any params - should use AI data
      const response = await app.request('/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ids: linkIds,
          action: 'confirm'
          // No params provided - should fallback to AI data
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.processed).toBe(2)
      expect(data.data.results).toHaveLength(2)

      // Verify links are published with AI data preserved in user fields
      const dbLink1 = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.id, linkIds[0]))
        .limit(1)

      expect(dbLink1[0].status).toBe('published')
      expect(dbLink1[0].userDescription).toBe('AI generated summary 1') // AI summary should be copied to userDescription
      expect(dbLink1[0].userCategory).toBe('AI-category-1') // AI category should be copied to userCategory
      expect(JSON.parse(dbLink1[0].userTags || '[]')).toEqual(['ai-tag1', 'ai-tag2']) // AI tags should be copied to userTags
      expect(dbLink1[0].publishedAt).toBeGreaterThanOrEqual(now)

      const dbLink2 = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.id, linkIds[1]))
        .limit(1)

      expect(dbLink2[0].status).toBe('published')
      expect(dbLink2[0].userDescription).toBe('AI generated summary 2')
      expect(dbLink2[0].userCategory).toBe('AI-category-2')
      expect(JSON.parse(dbLink2[0].userTags || '[]')).toEqual(['ai-tag3', 'ai-tag4'])
      expect(dbLink2[0].publishedAt).toBeGreaterThanOrEqual(now)
    })
  })
})