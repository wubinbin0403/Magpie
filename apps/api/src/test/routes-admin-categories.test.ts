import { describe, it, expect, beforeEach } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { categories, users, settings } from '../db/schema.js'
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

    // Add default category setting
    await testDrizzle.insert(settings).values({
      key: 'default_category',
      value: '技术',
      type: 'string',
      description: 'Default category',
      createdAt: now,
      updatedAt: now,
    })

    // Set up test categories in the categories table
    await testDrizzle.insert(categories).values([
      {
        id: 1,
        name: '技术',
        slug: 'tech',
        icon: 'code',
        description: 'Technology and programming',
        displayOrder: 1,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        name: '设计',
        slug: 'design',
        icon: 'palette',
        description: 'Design and UI/UX',
        displayOrder: 2,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 3,
        name: '工具',
        slug: 'tools',
        icon: 'wrench',
        description: 'Useful tools',
        displayOrder: 3,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      },
    ])
  })

  describe('GET /', () => {
    it('should require admin authentication', async () => {
      const res = await app.request('/')
      expect(res.status).toBe(401)
    })

    it('should return all categories ordered by displayOrder', async () => {
      const res = await app.request('/', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data).toBeDefined()

      const categoriesList = body.data
      expect(Array.isArray(categoriesList)).toBe(true)
      expect(categoriesList).toHaveLength(3)

      // Should be ordered by displayOrder
      expect(categoriesList[0].name).toBe('技术')
      expect(categoriesList[1].name).toBe('设计')
      expect(categoriesList[2].name).toBe('工具')

      // Check structure
      expect(categoriesList[0]).toHaveProperty('id')
      expect(categoriesList[0]).toHaveProperty('name')
      expect(categoriesList[0]).toHaveProperty('slug')
      expect(categoriesList[0]).toHaveProperty('icon')
      expect(categoriesList[0]).toHaveProperty('displayOrder')
      expect(categoriesList[0]).toHaveProperty('isActive')
    })
  })

  describe('GET /icons', () => {
    it('should require admin authentication', async () => {
      const res = await app.request('/icons')
      expect(res.status).toBe(401)
    })

    it('should return available icons list', async () => {
      const res = await app.request('/icons', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data.length).toBeGreaterThan(0)
      expect(body.data).toContain('folder')
      expect(body.data).toContain('code')
      expect(body.data).toContain('book')
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
          icon: 'folder',
          description: 'A new category'
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.name).toBe('新分类')
      expect(body.data.description).toBe('A new category')
      expect(body.data.icon).toBe('folder')
      expect(body.data.slug).toBeDefined()
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
      expect(body.error.code).toBe('DUPLICATE_ERROR')
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
      // zValidator may return different error formats, just check it's a validation error
    })

    it('should enforce maximum category limit of 7', async () => {
      // Add 4 more categories to reach the limit (we already have 3)
      const newCategories = ['生活', '娱乐', '学习', '资讯']
      
      for (const name of newCategories) {
        const res = await app.request('/', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name }),
        })
        
        expect(res.status).toBe(201)
      }
      
      // Now we have 7 categories total, trying to add 8th should fail
      const res = await app.request('/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: '第八个分类' }),
      })
      
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('CATEGORY_LIMIT_REACHED')
      expect(body.error.message).toContain('Maximum number of categories (7)')
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

      // Verify the category was updated in database
      const updatedCategory = await testDrizzle
        .select()
        .from(categories)
        .where(eq(categories.id, 2))
        .limit(1)

      expect(updatedCategory[0].name).toBe('设计更新')
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
      expect(body.error.code).toBe('DUPLICATE_ERROR')
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

      // Verify category was removed from database
      const deletedCategory = await testDrizzle
        .select()
        .from(categories)
        .where(eq(categories.id, 3))
        .limit(1)

      expect(deletedCategory).toHaveLength(0)
    })

    it('should allow deleting default category when other categories exist', async () => {
      // Try to delete '技术' category (default category) - should succeed since other active categories exist
      const res = await app.request('/1', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)

      // Verify category was removed from database
      const deletedCategory = await testDrizzle
        .select()
        .from(categories)
        .where(eq(categories.id, 1))
        .limit(1)

      expect(deletedCategory).toHaveLength(0)
    })

    it('should prevent deleting last active category when it is default', async () => {
      // First disable other categories to make '技术' the only active one
      await testDrizzle.update(categories)
        .set({ isActive: 0 })
        .where(eq(categories.id, 2)) // 设计

      await testDrizzle.update(categories)
        .set({ isActive: 0 })
        .where(eq(categories.id, 3)) // 工具

      // Now try to delete '技术' category (should fail)
      const res = await app.request('/1', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('CANNOT_DELETE_LAST_DEFAULT')
    })

    it('should move links to default category when deleting category with links', async () => {
      // First, create some test links with different categories
      const { links } = await import('../db/schema.js')
      
      // Create links in '设计' category (id=2)
      await testDrizzle.insert(links).values([
        {
          url: 'https://test1.com',
          domain: 'test1.com',
          title: 'Test Link 1',
          finalCategory: '设计',
          userCategory: '设计',
          aiCategory: '设计',
          status: 'published',
          createdAt: Math.floor(Date.now() / 1000),
          publishedAt: Math.floor(Date.now() / 1000),
        },
        {
          url: 'https://test2.com',
          domain: 'test2.com',
          title: 'Test Link 2',
          finalCategory: '设计',
          userCategory: '设计',
          aiCategory: '技术', // Different AI category
          status: 'published',
          createdAt: Math.floor(Date.now() / 1000),
          publishedAt: Math.floor(Date.now() / 1000),
        }
      ])

      // Verify links exist with '设计' category
      const linksBeforeDeletion = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.finalCategory, '设计'))
      expect(linksBeforeDeletion).toHaveLength(2)

      // Delete '设计' category (id=2)
      const res = await app.request('/2', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)

      // Verify category was removed from database
      const deletedCategory = await testDrizzle
        .select()
        .from(categories)
        .where(eq(categories.id, 2))
      expect(deletedCategory).toHaveLength(0)

      // Verify all links were moved to default category ('技术')
      const movedLinks = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.finalCategory, '技术'))
      expect(movedLinks.length).toBeGreaterThanOrEqual(2)

      // Verify no links remain in the deleted category
      const linksInDeletedCategory = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.finalCategory, '设计'))
      expect(linksInDeletedCategory).toHaveLength(0)

      // Verify user categories were also updated
      const linksWithUpdatedUserCategory = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.userCategory, '技术'))
      expect(linksWithUpdatedUserCategory.length).toBeGreaterThanOrEqual(2)
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

  describe('POST /reorder', () => {
    it('should require admin authentication', async () => {
      const res = await app.request('/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ categoryIds: [1, 2, 3] }),
      })
      expect(res.status).toBe(401)
    })

    it('should reorder categories', async () => {
      // Reverse the order: [3, 2, 1] instead of [1, 2, 3]
      const res = await app.request('/reorder', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ categoryIds: [3, 2, 1] }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)

      // Verify the new order in database
      const reorderedCategories = await testDrizzle
        .select()
        .from(categories)
        .orderBy(categories.displayOrder)

      expect(reorderedCategories[0].id).toBe(3) // '工具' should be first
      expect(reorderedCategories[0].displayOrder).toBe(1)
      expect(reorderedCategories[1].id).toBe(2) // '设计' should be second
      expect(reorderedCategories[1].displayOrder).toBe(2)
      expect(reorderedCategories[2].id).toBe(1) // '技术' should be third
      expect(reorderedCategories[2].displayOrder).toBe(3)
    })

    it('should validate categoryIds array', async () => {
      const res = await app.request('/reorder', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ categoryIds: 'invalid' }),
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      // zValidator may return different error formats, just check it's a validation error
    })
  })
})