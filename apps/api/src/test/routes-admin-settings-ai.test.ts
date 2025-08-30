import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { users, settings } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { createAdminSettingsRouter } from '../routes/admin/settings.js'
import { hashPassword, createAdminJWT } from '../utils/auth.js'

// Mock AI analyzer
vi.mock('../services/ai-analyzer.js', () => ({
  createAIAnalyzer: vi.fn()
}))

describe('Admin AI Settings Tests', () => {
  let app: any
  let adminToken: string
  let mockCreateAIAnalyzer: any

  beforeEach(async () => {
    clearTestData()
    
    // Use real router with test database injection
    app = createAdminSettingsRouter(testDrizzle)
    
    // Get mock functions
    const { createAIAnalyzer } = await import('../services/ai-analyzer.js')
    mockCreateAIAnalyzer = createAIAnalyzer as any
    mockCreateAIAnalyzer.mockReset()
    
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
    
    // Initialize AI settings
    await testDrizzle.insert(settings).values([
      {
        key: 'openai_api_key',
        value: 'test-api-key',
        type: 'string',
        description: 'Test OpenAI API key',
        createdAt: now,
        updatedAt: now,
      },
      {
        key: 'openai_base_url',
        value: 'https://api.openai.com/v1',
        type: 'string',
        description: 'OpenAI API base URL',
        createdAt: now,
        updatedAt: now,
      },
      {
        key: 'ai_model',
        value: 'gpt-3.5-turbo',
        type: 'string',
        description: 'AI model to use',
        createdAt: now,
        updatedAt: now,
      },
      {
        key: 'ai_temperature',
        value: '0.7',
        type: 'number',
        description: 'AI temperature setting',
        createdAt: now,
        updatedAt: now,
      }
    ])
  })

  describe('POST /ai/test', () => {
    it('should require admin authentication', async () => {
      const response = await app.request('/ai/test', {
        method: 'POST'
      })
      
      expect(response.status).toBe(401)
    })

    it('should fail if AI API key is not configured', async () => {
      // Remove API key
      await testDrizzle
        .delete(settings)
        .where(eq(settings.key, 'openai_api_key'))

      const response = await app.request('/ai/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json() as any

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('AI_SERVICE_ERROR')
      expect(data.error.message).toContain('not configured')
    })

    it('should successfully test AI connection and analysis', async () => {
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

      const response = await app.request('/ai/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.connected).toBe(true)
      expect(data.data.model).toBe('gpt-3.5-turbo')
      expect(data.data.baseUrl).toBe('https://api.openai.com/v1')
      expect(data.data.responseTime).toBeGreaterThanOrEqual(0)
      
      // Verify test analysis results
      expect(data.data.testAnalysis).toEqual({
        summary: 'This is a test summary of the article content.',
        category: 'tech',
        tags: ['test', 'ai', 'technology'],
        language: 'en',
        sentiment: 'neutral',
        readingTime: 2
      })
      
      // Verify mocks were called correctly
      expect(mockCreateAIAnalyzer).toHaveBeenCalledWith(expect.objectContaining({
        openai_api_key: 'test-api-key',
        openai_base_url: 'https://api.openai.com/v1',
        ai_model: 'gpt-3.5-turbo',
        ai_temperature: 0.7
      }))
      
      expect(mockAnalyzer.testConnection).toHaveBeenCalled()
      expect(mockAnalyzer.analyze).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://example.com/test-article',
        contentType: 'article',
        title: 'Test AI Analysis',
        description: 'This is a test article for AI analysis capabilities.',
        wordCount: 27,
        language: 'en'
      }))
    })

    it('should handle AI connection failure', async () => {
      const mockAnalyzer = {
        testConnection: vi.fn().mockResolvedValue(false)
      }
      
      mockCreateAIAnalyzer.mockResolvedValue(mockAnalyzer)

      const response = await app.request('/ai/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json() as any

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('AI_SERVICE_ERROR')
      expect(data.error.message).toContain('connection failed')
    })

    it('should handle AI analysis failure', async () => {
      const mockAnalyzer = {
        testConnection: vi.fn().mockResolvedValue(true),
        analyze: vi.fn().mockRejectedValue(new Error('AI analysis failed'))
      }
      
      mockCreateAIAnalyzer.mockResolvedValue(mockAnalyzer)

      const response = await app.request('/ai/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json() as any

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('AI_SERVICE_ERROR')
      expect(data.error.message).toContain('AI analysis failed')
      expect(data.error.details.model).toBe('gpt-3.5-turbo')
      expect(data.error.details.baseUrl).toBe('https://api.openai.com/v1')
      expect(data.error.details.responseTime).toBeGreaterThanOrEqual(0)
    })

    it('should handle AI service creation failure', async () => {
      mockCreateAIAnalyzer.mockRejectedValue(new Error('Invalid API key'))

      const response = await app.request('/ai/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json() as any

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('AI_SERVICE_ERROR')
      expect(data.error.message).toContain('Invalid API key')
    })

    it('should work with different AI models and settings', async () => {
      // Update AI settings
      const now = Math.floor(Date.now() / 1000)
      // Update AI model setting
      await testDrizzle
        .update(settings)
        .set({ value: 'gpt-4', updatedAt: now })
        .where(eq(settings.key, 'ai_model'))
      
      // Update AI temperature setting  
      await testDrizzle
        .update(settings)
        .set({ value: '0.3', updatedAt: now })
        .where(eq(settings.key, 'ai_temperature'))

      const mockAnalyzer = {
        testConnection: vi.fn().mockResolvedValue(true),
        analyze: vi.fn().mockResolvedValue({
          summary: 'GPT-4 generated summary',
          category: 'tech',
          tags: ['gpt4', 'ai'],
          language: 'en',
          sentiment: 'positive',
          readingTime: 1
        })
      }
      
      mockCreateAIAnalyzer.mockResolvedValue(mockAnalyzer)

      const response = await app.request('/ai/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.data.model).toBe('gpt-4')
      expect(data.data.testAnalysis.summary).toBe('GPT-4 generated summary')
      
      // Verify settings were passed correctly
      expect(mockCreateAIAnalyzer).toHaveBeenCalledWith(expect.objectContaining({
        ai_model: 'gpt-4',
        ai_temperature: 0.3
      }))
    })

    it('should test AI with custom base URL', async () => {
      // Set custom base URL
      const now = Math.floor(Date.now() / 1000)
      // Update base URL setting
      await testDrizzle
        .update(settings)
        .set({ value: 'https://custom-ai-endpoint.com/v1', updatedAt: now })
        .where(eq(settings.key, 'openai_base_url'))

      const mockAnalyzer = {
        testConnection: vi.fn().mockResolvedValue(true),
        analyze: vi.fn().mockResolvedValue({
          summary: 'Custom endpoint summary',
          category: 'tech',
          tags: ['custom'],
          language: 'en',
          sentiment: 'neutral',
          readingTime: 1
        })
      }
      
      mockCreateAIAnalyzer.mockResolvedValue(mockAnalyzer)

      const response = await app.request('/ai/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.data.baseUrl).toBe('https://custom-ai-endpoint.com/v1')
      expect(data.data.connected).toBe(true)
    })
  })
})