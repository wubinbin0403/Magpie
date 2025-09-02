import { describe, it, expect, beforeEach } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { links, users } from '../db/schema.js'
import { createAdminPendingRouter } from '../routes/admin/pending.js'
import { hashPassword, createAdminJWT } from '../utils/auth.js'

describe('Admin Pending Links API', () => {
  let app: any
  let adminToken: string

  beforeEach(async () => {
    clearTestData()
    
    // Use real router with test database injection
    app = createAdminPendingRouter(testDrizzle)
    
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

  describe('GET /', () => {
    it('should require admin authentication', async () => {
      const response = await app.request('/')
      const data = await response.json() as any

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })

    it('should return empty list when no pending links exist', async () => {
      const response = await app.request('/', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.links).toEqual([])
      expect(data.data.pagination.total).toBe(0)
    })

    it('should return pending links', async () => {
      // Create test data
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/pending1',
            domain: 'example.com',
            title: 'Pending Link 1',
            originalDescription: 'Original description 1',
            aiSummary: 'AI summary 1',
            aiCategory: 'tech',
            aiTags: JSON.stringify(['tag1', 'tag2']),
            status: 'pending',
            createdAt: now,
          },
          {
            url: 'https://example.com/published',
            domain: 'example.com',
            title: 'Published Link',
            userDescription: 'Final description',
            userCategory: 'tech',
            userTags: JSON.stringify(['published']),
            status: 'published',
            publishedAt: now,
            createdAt: now,
          },
          {
            url: 'https://example.com/pending2',
            domain: 'example.com',
            title: 'Pending Link 2',
            originalDescription: 'Original description 2',
            aiSummary: 'AI summary 2',
            aiCategory: 'art',
            aiTags: JSON.stringify(['art', 'design']),
            userDescription: 'User override description',
            userCategory: 'design',
            userTags: JSON.stringify(['user-tag']),
            status: 'pending',
            createdAt: now + 1,
          }
        ])

      const response = await app.request('/', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.links).toHaveLength(2)
      expect(data.data.pagination.total).toBe(2)
      
      // Check first link (newer one should be first)
      expect(data.data.links[0].title).toBe('Pending Link 2')
      expect(data.data.links[0].status).toBe('pending')
      expect(data.data.links[0].userDescription).toBe('User override description')
      expect(data.data.links[0].userTags).toEqual(['user-tag'])
    })

    it('should support pagination', async () => {
      // Create multiple pending links
      const now = Math.floor(Date.now() / 1000)
      const linkData = Array.from({ length: 15 }, (_, i) => ({
        url: `https://example.com/pending-${i}`,
        domain: 'example.com',
        title: `Pending Link ${i}`,
        originalDescription: `Description ${i}`,
        aiSummary: `Summary ${i}`,
        aiCategory: 'tech',
        aiTags: JSON.stringify([`tag${i}`]),
        status: 'pending' as const,
        createdAt: now + i,
      }))

      await testDrizzle.insert(links).values(linkData)

      // Test first page
      const response1 = await app.request('/?page=1&limit=10', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const data1 = await response1.json() as any

      expect(response1.status).toBe(200)
      expect(data1.data.links).toHaveLength(10)
      expect(data1.data.pagination.page).toBe(1)
      expect(data1.data.pagination.total).toBe(15)
      expect(data1.data.pagination.pages).toBe(2)
      expect(data1.data.pagination.hasNext).toBe(true)

      // Test second page
      const response2 = await app.request('/?page=2&limit=10', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const data2 = await response2.json() as any

      expect(data2.data.links).toHaveLength(5)
      expect(data2.data.pagination.hasNext).toBe(false)
      expect(data2.data.pagination.hasPrev).toBe(true)
    })

    it('should filter by domain', async () => {
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/test',
            domain: 'example.com',
            title: 'Example Link',
            originalDescription: 'Example description',
            aiSummary: 'Example summary',
            aiCategory: 'tech',
            aiTags: '[]',
            status: 'pending',
            createdAt: now,
          },
          {
            url: 'https://another.com/test',
            domain: 'another.com',
            title: 'Another Link',
            originalDescription: 'Another description',
            aiSummary: 'Another summary',
            aiCategory: 'tech',
            aiTags: '[]',
            status: 'pending',
            createdAt: now,
          }
        ])

      const response = await app.request('/?domain=example.com', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.data.links).toHaveLength(1)
      expect(data.data.links[0].domain).toBe('example.com')
    })

    it('should filter by category', async () => {
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/tech',
            domain: 'example.com',
            title: 'Tech Link',
            originalDescription: 'Tech description',
            aiSummary: 'Tech summary',
            aiCategory: 'tech',
            aiTags: '[]',
            status: 'pending',
            createdAt: now,
          },
          {
            url: 'https://example.com/art',
            domain: 'example.com',
            title: 'Art Link',
            originalDescription: 'Art description',
            aiSummary: 'Art summary',
            aiCategory: 'art',
            aiTags: '[]',
            status: 'pending',
            createdAt: now,
          }
        ])

      const response = await app.request('/?category=tech', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.data.links).toHaveLength(1)
      expect(data.data.links[0].aiCategory).toBe('tech')
    })

    it('should sort by oldest first', async () => {
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/new',
            domain: 'example.com',
            title: 'New Link',
            originalDescription: 'New description',
            aiSummary: 'New summary',
            aiCategory: 'tech',
            aiTags: '[]',
            status: 'pending',
            createdAt: now,
          },
          {
            url: 'https://example.com/old',
            domain: 'example.com',
            title: 'Old Link',
            originalDescription: 'Old description',
            aiSummary: 'Old summary',
            aiCategory: 'tech',
            aiTags: '[]',
            status: 'pending',
            createdAt: now - 100,
          }
        ])

      const response = await app.request('/?sort=oldest', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.data.links[0].title).toBe('Old Link')
    })

    it('should reject non-admin users', async () => {
      // Create a non-admin token
      const nonAdminToken = createAdminJWT({
        userId: 999,
        username: 'user',
        role: 'user'
      })

      const response = await app.request('/', {
        headers: {
          'Authorization': `Bearer ${nonAdminToken}`
        }
      })
      const data = await response.json() as any

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
    })
  })
})