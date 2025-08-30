import { describe, it, expect, beforeEach } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { settings, links, users } from '../db/schema.js'
import { createAdminCategoriesRouter } from '../routes/admin/categories.js'
import { createAdminJWT, hashPassword } from '../utils/auth.js'
import { eq } from 'drizzle-orm'

describe('Admin Categories API', () => {
  let app: any
  let adminToken: string

  beforeEach(async () => {
    clearTestData()

    // Use real router with test database injection
    app = createAdminCategoriesRouter(testDrizzle)

    // Create admin user
    const { hash, salt } = await hashPassword('testpassword')
    const now = Math.floor(Date.now() / 1000)
    
    await testDrizzle.insert(users).values({
      id: 1,
      username: 'admin',
      passwordHash: hash,
      salt,
      role: 'admin',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })

    // Create admin token
    adminToken = createAdminJWT({
      userId: 1,
      username: 'admin',
      role: 'admin'
    })

    // Set up predefined categories
    await testDrizzle.insert(settings).values({
      key: 'content.categories',
      value: JSON.stringify(['技术', '设计', '工具']),
      type: 'json',
      description: 'Predefined content categories',
      createdAt: now,
      updatedAt: now,
    })

    // Add some test links with categories
    await testDrizzle.insert(links).values([
      {
        id: 1,
        url: 'https://example.com/tech1',
        domain: 'example.com',
        title: 'Tech Article 1',
        finalCategory: '技术',
        finalDescription: 'A tech article',
        finalTags: JSON.stringify(['tech', 'programming']),
        status: 'published',
        createdAt: now,
        publishedAt: now,
        searchText: 'tech article programming',
        clickCount: 0,
      },
      {
        id: 2,
        url: 'https://example.com/tech2',
        domain: 'example.com',
        title: 'Tech Article 2',
        finalCategory: '技术',
        finalDescription: 'Another tech article',
        finalTags: JSON.stringify(['tech', 'javascript']),
        status: 'published',
        createdAt: now,
        publishedAt: now,
        searchText: 'tech article javascript',
        clickCount: 0,
      },
      {
        id: 3,
        url: 'https://example.com/design1',
        domain: 'example.com',
        title: 'Design Article',
        finalCategory: '设计',
        finalDescription: 'A design article',
        finalTags: JSON.stringify(['design', 'ui']),
        status: 'published',
        createdAt: now,
        publishedAt: now,
        searchText: 'design article ui',
        clickCount: 0,
      },
      {
        id: 4,
        url: 'https://example.com/misc1',
        domain: 'example.com',
        title: 'Misc Article',
        finalCategory: '其他',
        finalDescription: 'A misc article',
        finalTags: JSON.stringify(['misc']),
        status: 'published',
        createdAt: now,
        publishedAt: now,
        searchText: 'misc article',
        clickCount: 0,
      },
      {
        id: 5,
        url: 'https://example.com/pending1',
        domain: 'example.com',
        title: 'Pending Article',
        finalCategory: '技术',
        finalDescription: 'A pending article',
        finalTags: JSON.stringify(['tech']),
        status: 'pending',
        createdAt: now,
        searchText: 'pending article tech',
        clickCount: 0,
      },
    ])
  })

  describe('GET /', () => {
    it('should require admin authentication', async () => {
      const res = await app.request('/')
      expect(res.status).toBe(401)
    })

    it('should return categories with statistics by default', async () => {
      const res = await app.request('/', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('categories')

      const categories = body.data.categories
      expect(Array.isArray(categories)).toBe(true)

      // Should include predefined categories with stats
      const techCategory = categories.find((c: any) => c.name === '技术')
      expect(techCategory).toBeDefined()
      expect(techCategory.linkCount).toBe(2) // 2 published tech articles
      expect(techCategory.isPredefined).toBe(true)

      const designCategory = categories.find((c: any) => c.name === '设计')
      expect(designCategory).toBeDefined()
      expect(designCategory.linkCount).toBe(1)
      expect(designCategory.isPredefined).toBe(true)

      const toolsCategory = categories.find((c: any) => c.name === '工具')
      expect(toolsCategory).toBeDefined()
      expect(toolsCategory.linkCount).toBe(0) // No links with this category
      expect(toolsCategory.isPredefined).toBe(true)

      const otherCategory = categories.find((c: any) => c.name === '其他')
      expect(otherCategory).toBeDefined()
      expect(otherCategory.linkCount).toBe(1)
      expect(otherCategory.isPredefined).toBe(false)
    })

    it('should return categories without stats when includeStats=false', async () => {
      const res = await app.request('/?includeStats=false', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)

      const categories = body.data.categories
      expect(Array.isArray(categories)).toBe(true)

      // Should not have linkCount property
      categories.forEach((category: any) => {
        expect(category).toHaveProperty('name')
        expect(category).toHaveProperty('isPredefined')
        expect(category).not.toHaveProperty('linkCount')
      })

      // Check for all expected categories
      const categoryNames = categories.map((c: any) => c.name)
      expect(categoryNames).toContain('技术')
      expect(categoryNames).toContain('设计')
      expect(categoryNames).toContain('工具')
      expect(categoryNames).toContain('其他')
    })

    it('should filter by status=all to include pending links', async () => {
      const res = await app.request('/?status=all', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()

      const techCategory = body.data.categories.find((c: any) => c.name === '技术')
      expect(techCategory.linkCount).toBe(3) // 2 published + 1 pending
    })

    it('should filter by status=pending', async () => {
      const res = await app.request('/?status=pending', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()

      const techCategory = body.data.categories.find((c: any) => c.name === '技术')
      expect(techCategory.linkCount).toBe(1) // 1 pending

      const designCategory = body.data.categories.find((c: any) => c.name === '设计')
      expect(designCategory.linkCount).toBe(0) // No pending design articles

      // Should not include '其他' category as it has no pending links
      const categories = body.data.categories
      expect(categories.some((c: any) => c.name === '其他')).toBe(false)
    })
  })

  describe('POST /', () => {
    it('should require admin authentication', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: '新分类' }),
      })
      expect(res.status).toBe(401)
    })

    it('should create a new category', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: '新分类',
          description: 'A new category'
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.name).toBe('新分类')
      expect(body.data.description).toBe('A new category')
      expect(body.data.isPredefined).toBe(true)

      // Verify the category was added to settings
      const categorySettings = await testDrizzle
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, 'content.categories'))
        .limit(1)

      const categories = JSON.parse(categorySettings[0].value)
      expect(categories).toContain('新分类')
    })

    it('should return error for duplicate category', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: '技术' }),
      })

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('DUPLICATE_CATEGORY')
    })

    it('should validate required fields', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description: 'Missing name' }),
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('PUT /:id', () => {
    it('should require admin authentication', async () => {
      const res = await app.request('/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: '技术更新' }),
      })
      expect(res.status).toBe(401)
    })

    it('should update a category name', async () => {
      const res = await app.request('/2', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: '设计更新' }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.name).toBe('设计更新')

      // Verify links were updated
      const updatedLinks = await testDrizzle
        .select({ finalCategory: links.finalCategory })
        .from(links)
        .where(eq(links.id, 3))

      expect(updatedLinks[0].finalCategory).toBe('设计更新')

      // Verify settings were updated
      const categorySettings = await testDrizzle
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, 'content.categories'))
        .limit(1)

      const categories = JSON.parse(categorySettings[0].value)
      expect(categories).toContain('设计更新')
      expect(categories).not.toContain('设计')
    })

    it('should return error for invalid ID', async () => {
      const res = await app.request('/999', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: '不存在' }),
      })

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.success).toBe(false)
    })

    it('should return error for duplicate name', async () => {
      const res = await app.request('/1', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: '设计' }), // Already exists
      })

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('DUPLICATE_CATEGORY')
    })
  })

  describe('DELETE /:id', () => {
    it('should require admin authentication', async () => {
      const res = await app.request('/3', {
        method: 'DELETE',
      })
      expect(res.status).toBe(401)
    })

    it('should delete an unused category', async () => {
      // Delete '工具' category (id=3, not used by any links)
      const res = await app.request('/3', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.name).toBe('工具')

      // Verify category was removed from settings
      const categorySettings = await testDrizzle
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, 'content.categories'))
        .limit(1)

      const categories = JSON.parse(categorySettings[0].value)
      expect(categories).not.toContain('工具')
      expect(categories).toContain('技术')
      expect(categories).toContain('设计')
    })

    it('should return error when deleting a category in use', async () => {
      // Try to delete '技术' category (id=1, used by links)
      const res = await app.request('/1', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('CATEGORY_IN_USE')
    })

    it('should return error for invalid ID', async () => {
      const res = await app.request('/999', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.success).toBe(false)
    })
  })
})