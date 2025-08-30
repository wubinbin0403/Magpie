import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { settings, users } from '../db/schema.js'
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
      { key: 'items_per_page', value: '20', type: 'number', description: 'Items per page' },
    ]

    for (const setting of defaultSettings) {
      await testDrizzle.insert(settings).values({
        ...setting,
        createdAt: now,
        updatedAt: now,
      })
    }

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
      expect(body.data.ai.apiKey).toMatch(/^sk-\*+/) // Should be masked
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
      const categories = await testDrizzle.select().from(settings).where(eq(settings.key, 'categories'))
      expect(JSON.parse(categories[0].value!)).toEqual(['Tech', 'Design', 'Product'])
      
      const itemsPerPage = await testDrizzle.select().from(settings).where(eq(settings.key, 'items_per_page'))
      expect(itemsPerPage[0].value).toBe('50')
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