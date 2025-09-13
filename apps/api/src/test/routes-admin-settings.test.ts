import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { settings, users, categories } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { hashPassword, createAdminJWT } from '../utils/auth.js'
import { createAdminSettingsRouter } from '../routes/admin/settings.js'

// Mock AI analyzer
vi.mock('../services/ai-analyzer.js', () => ({
  createAIAnalyzer: vi.fn()
}))

describe('Admin Settings API', () => {
  let app: any
  let jwtToken: string
  let adminUserId: number
  let mockCreateAIAnalyzer: any

  beforeEach(async () => {
    clearTestData()

    // Use real router with test database injection
    app = createAdminSettingsRouter(testDrizzle)
    
    // Get mock functions
    const { createAIAnalyzer } = await import('../services/ai-analyzer.js')
    mockCreateAIAnalyzer = createAIAnalyzer as any
    mockCreateAIAnalyzer.mockReset()

    // Initialize default settings
    const now = Math.floor(Date.now() / 1000)
    const defaultSettings = [
      { key: 'site_title', value: 'Test Site', type: 'string', description: 'Site title' },
      { key: 'site_description', value: 'Test description', type: 'string', description: 'Site description' },
      { key: 'openai_api_key', value: 'sk-test123', type: 'string', description: 'API key' },
      { key: 'openai_base_url', value: 'https://api.openai.com/v1', type: 'string', description: 'Base URL' },
      { key: 'ai_model', value: 'gpt-3.5-turbo', type: 'string', description: 'Model' },
      { key: 'ai_temperature', value: '0.7', type: 'number', description: 'Temperature' },
      { key: 'categories', value: '["技术", "设计"]', type: 'json', description: 'Categories' },
      { key: 'default_category', value: '技术', type: 'string', description: 'Default category' },
      { key: 'items_per_page', value: '20', type: 'number', description: 'Items per page' },
    ]

    for (const setting of defaultSettings) {
      await testDrizzle.insert(settings).values({
        ...setting,
        createdAt: now,
        updatedAt: now,
      })
    }

    // Create test categories in the categories table
    await testDrizzle.insert(categories).values([
      {
        name: '技术',
        slug: 'tech',
        icon: 'code-bracket',
        description: 'Technology category',
        displayOrder: 0,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: '设计',
        slug: 'design',
        icon: 'paint-brush',
        description: 'Design category',
        displayOrder: 1,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: '产品',
        slug: 'product',
        icon: 'cube',
        description: 'Product category',
        displayOrder: 2,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      }
    ])

    // Create admin user
    const { hash, salt } = await hashPassword('admin123')
    const userResult = await testDrizzle.insert(users).values({
      username: 'admin',
      passwordHash: hash,
      salt,
      role: 'admin',
      status: 'active',
      createdAt: now,
    }).returning({ id: users.id })

    adminUserId = userResult[0].id

    // Create JWT token for admin
    jwtToken = createAdminJWT({
      userId: adminUserId,
      username: 'admin',
      role: 'admin'
    })
  })

  describe('GET /', () => {
    it('should require admin authentication', async () => {
      const res = await app.request('/')
      expect(res.status).toBe(401)
    })

    it('should return settings with JWT token', async () => {
      const res = await app.request('/', {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
        },
      })
      
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.site.title).toBe('Test Site')
      expect(body.data.site.description).toBe('Test description')
      expect(body.data.ai.apiKey).toBe('***CONFIGURED***') // Should be masked
      expect(body.data.ai.baseUrl).toBe('https://api.openai.com/v1')
      expect(body.data.ai.model).toBe('gpt-3.5-turbo')
      expect(body.data.ai.temperature).toBe(0.7)
      expect(body.data.content.categories).toEqual(['技术', '设计'])
      expect(body.data.content.itemsPerPage).toBe(20)
    })
  })

  describe('PUT /', () => {
    it('should require admin authentication', async () => {
      const res = await app.request('/', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          site: { title: 'New Title' },
        }),
      })
      expect(res.status).toBe(401)
    })

    it('should update site settings', async () => {
      const res = await app.request('/', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          site: {
            title: 'Updated Title',
            description: 'Updated description',
          },
        }),
      })
      
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('updated')

      // Verify the update
      const updated = await testDrizzle.select().from(settings).where(eq(settings.key, 'site_title'))
      expect(updated[0].value).toBe('Updated Title')
    })

    it('should update AI settings', async () => {
      const res = await app.request('/', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ai: {
            apiKey: 'sk-new-key',
            model: 'gpt-4',
            temperature: 0.5,
          },
        }),
      })
      
      expect(res.status).toBe(200)
      
      // Verify the updates
      const apiKey = await testDrizzle.select().from(settings).where(eq(settings.key, 'openai_api_key'))
      expect(apiKey[0].value).toBe('sk-new-key')
      
      const model = await testDrizzle.select().from(settings).where(eq(settings.key, 'ai_model'))
      expect(model[0].value).toBe('gpt-4')
      
      const temp = await testDrizzle.select().from(settings).where(eq(settings.key, 'ai_temperature'))
      expect(temp[0].value).toBe('0.5')
    })

    it('should update content settings', async () => {
      const res = await app.request('/', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: {
            categories: ['Tech', 'Design', 'Product'],
            itemsPerPage: 50,
          },
        }),
      })
      
      expect(res.status).toBe(200)
      
      // Verify the updates
      const categoriesResult = await testDrizzle.select().from(settings).where(eq(settings.key, 'categories'))
      expect(JSON.parse(categoriesResult[0].value!)).toEqual(['Tech', 'Design', 'Product'])
      
      const itemsPerPage = await testDrizzle.select().from(settings).where(eq(settings.key, 'items_per_page'))
      expect(itemsPerPage[0].value).toBe('50')
    })

    it('should update default category to an existing category', async () => {
      const res = await app.request('/', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: {
            defaultCategory: '设计',
          },
        }),
      })
      
      expect(res.status).toBe(200)
      
      // Verify the update
      const defaultCategory = await testDrizzle.select().from(settings).where(eq(settings.key, 'default_category'))
      expect(defaultCategory[0].value).toBe('设计')
    })

    it('should reject default category that does not exist', async () => {
      const res = await app.request('/', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: {
            defaultCategory: '不存在的分类',
          },
        }),
      })
      
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('INVALID_DEFAULT_CATEGORY')
      expect(body.error.message).toContain('does not exist')
    })

    it('should reject inactive category as default', async () => {
      // First, deactivate a category
      await testDrizzle.update(categories)
        .set({ isActive: 0 })
        .where(eq(categories.name, '产品'))
      
      const res = await app.request('/', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: {
            defaultCategory: '产品',
          },
        }),
      })
      
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('INACTIVE_DEFAULT_CATEGORY')
      expect(body.error.message).toContain('must be active')
    })

    it('should allow empty aboutUrl in site settings', async () => {
      const res = await app.request('/', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          site: {
            title: 'Test Site',
            description: 'Test description',
            aboutUrl: '',
          },
        }),
      })
      
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      
      // Verify the update
      const aboutUrl = await testDrizzle.select().from(settings).where(eq(settings.key, 'about_url'))
      expect(aboutUrl[0].value).toBe('')
    })

    it('should validate aboutUrl when provided', async () => {
      const res = await app.request('/', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          site: {
            aboutUrl: 'not-a-valid-url',
          },
        }),
      })
      
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      // Zod validation returns error in a different format
      expect(body.error).toBeDefined()
      expect(body.error.name).toBe('ZodError')
    })
  })

  describe('POST /ai/test', () => {
    it('should require admin authentication', async () => {
      const res = await app.request('/ai/test', {
        method: 'POST',
      })
      expect(res.status).toBe(401)
    })

    it('should test AI connection', async () => {
      // Mock AI analyzer and its methods
      const mockAnalyzer = {
        testConnection: vi.fn().mockResolvedValue(true),
        analyze: vi.fn().mockResolvedValue({
          summary: 'This is a test summary of the article content.',
          category: 'tech',
          tags: ['test', 'ai', 'technology'],
          language: 'en',
          sentiment: 'neutral',
          readingTime: 2
        })
      }
      
      mockCreateAIAnalyzer.mockResolvedValue(mockAnalyzer)
      
      const res = await app.request('/ai/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
        },
      })
      
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data).toHaveProperty('connected')
      expect(body.data).toHaveProperty('model')
      expect(body.data).toHaveProperty('responseTime')
      expect(body.data).toHaveProperty('testAnalysis')
    })
  })
})