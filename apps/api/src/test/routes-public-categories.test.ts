import { describe, it, expect, beforeEach } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { categories, links } from '../db/schema.js'
import { createPublicCategoriesRouter } from '../routes/public/categories.js'
import { eq } from 'drizzle-orm'

describe('Public Categories API', () => {
  let app: any

  beforeEach(async () => {
    clearTestData()

    // Use real router with test database injection
    app = createPublicCategoriesRouter(testDrizzle)

    const now = Math.floor(Date.now() / 1000)

    // Set up test categories
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
        isActive: 0, // Inactive category
        createdAt: now,
        updatedAt: now,
      },
    ])

    // Add some test links to calculate counts
    await testDrizzle.insert(links).values([
      {
        id: 1,
        url: 'https://example.com/tech1',
        domain: 'example.com',
        title: 'Tech Article 1',
        userCategory: '技术',
        userDescription: 'A tech article',
        userTags: JSON.stringify(['tech', 'programming']),
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
        userCategory: '技术',
        userDescription: 'Another tech article',
        userTags: JSON.stringify(['tech', 'javascript']),
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
        userCategory: '设计',
        userDescription: 'A design article',
        userTags: JSON.stringify(['design', 'ui']),
        status: 'published',
        createdAt: now,
        publishedAt: now,
        searchText: 'design article ui',
        clickCount: 0,
      },
      {
        id: 4,
        url: 'https://example.com/pending',
        domain: 'example.com',
        title: 'Pending Article',
        userCategory: '技术',
        userDescription: 'A pending article',
        userTags: JSON.stringify(['tech']),
        status: 'pending', // Pending, should not count
        createdAt: now,
        searchText: 'pending article tech',
        clickCount: 0,
      },
    ])
  })

  describe('GET /', () => {
    it('should return active categories with link counts', async () => {
      const res = await app.request('/')
      
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data).toBeDefined()
      
      const categoriesList = body.data
      expect(Array.isArray(categoriesList)).toBe(true)
      expect(categoriesList).toHaveLength(2) // Only active categories
      
      // Should be ordered by displayOrder
      expect(categoriesList[0].name).toBe('技术')
      expect(categoriesList[1].name).toBe('设计')
      
      // Check structure and data
      const techCategory = categoriesList[0]
      expect(techCategory).toHaveProperty('id')
      expect(techCategory).toHaveProperty('name')
      expect(techCategory).toHaveProperty('slug')
      expect(techCategory).toHaveProperty('icon')
      expect(techCategory).toHaveProperty('description')
      expect(techCategory).toHaveProperty('displayOrder')
      expect(techCategory).toHaveProperty('linkCount')
      
      // Check link counts (only published links)
      expect(techCategory.linkCount).toBe(2) // 2 published tech articles
      expect(categoriesList[1].linkCount).toBe(1) // 1 published design article
      
      // Should not include inactive categories
      expect(categoriesList.find(cat => cat.name === '工具')).toBeUndefined()
    })
    
    it('should handle categories with no links', async () => {
      // Create a new active category with no links
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle.insert(categories).values({
        id: 4,
        name: '其他',
        slug: 'other',
        icon: 'folder',
        description: 'Other category',
        displayOrder: 4,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      })
      
      const res = await app.request('/')
      
      expect(res.status).toBe(200)
      const body = await res.json()
      const categoriesList = body.data
      
      expect(categoriesList).toHaveLength(3)
      const otherCategory = categoriesList.find(cat => cat.name === '其他')
      expect(otherCategory).toBeDefined()
      expect(otherCategory.linkCount).toBe(0)
    })
    
    it('should return categories in display order', async () => {
      // Update display orders to test sorting
      await testDrizzle.update(categories)
        .set({ displayOrder: 10 })
        .where(eq(categories.id, 1)) // 技术
        
      await testDrizzle.update(categories)
        .set({ displayOrder: 5 })
        .where(eq(categories.id, 2)) // 设计
      
      const res = await app.request('/')
      
      expect(res.status).toBe(200)
      const body = await res.json()
      const categoriesList = body.data
      
      // Should now be ordered: 设计 (5), 技术 (10)
      expect(categoriesList[0].name).toBe('设计')
      expect(categoriesList[1].name).toBe('技术')
    })
    
    it('should return empty array when no active categories', async () => {
      // Deactivate all categories
      await testDrizzle.update(categories)
        .set({ isActive: 0 })
      
      const res = await app.request('/')
      
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data).toEqual([])
    })
    
    it('should have correct response headers', async () => {
      const res = await app.request('/')
      
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toContain('application/json')
    })
  })
})