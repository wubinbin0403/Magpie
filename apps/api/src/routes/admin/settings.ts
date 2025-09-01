import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { settings } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { sendSuccess, sendError } from '../../utils/response.js'
import { requireAdmin } from '../../middleware/admin.js'
import { getSettings, setSetting } from '../../utils/settings.js'
import { createAIAnalyzer } from '../../services/ai-analyzer.js'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

// Schema definitions
const updateSettingsSchema = z.object({
  site: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    aboutUrl: z.string().optional(),
  }).optional(),
  ai: z.object({
    apiKey: z.string().optional(),
    baseUrl: z.string().url().optional(),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    summaryPrompt: z.string().optional(),
    categoryPrompt: z.string().optional(),
  }).optional(),
  content: z.object({
    defaultCategory: z.string().optional(),
    categories: z.array(z.string()).optional(),
    itemsPerPage: z.number().min(1).max(100).optional(),
  }).optional(),
})

// Create admin settings router with optional database dependency injection
function createAdminSettingsRouter(database = db) {
  const app = new Hono()

  // Error handling middleware
  app.onError((err, c) => {
    console.error('Admin Settings API Error:', err)
    
    if (err.message.includes('ZodError') || err.name === 'ZodError') {
      return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
    }
    
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred', undefined, 500)
  })

  // Helper function to mask API key for display
  function maskApiKey(key: string): string {
    if (!key || key.length < 8) return key
    const prefix = key.substring(0, 3)
    const masked = '*'.repeat(Math.max(0, key.length - 6))
    const suffix = key.substring(Math.max(0, key.length - 3))
    return prefix + masked + suffix
  }

  // Helper function to get setting value by key
  async function getSetting(key: string): Promise<string | null> {
    const result = await database
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1)
    
    return result.length > 0 ? result[0].value : null
  }

  // Helper function to set setting value
  async function setSetting(key: string, value: string, type: 'string' | 'number' | 'boolean' | 'json' = 'string'): Promise<void> {
    const now = Math.floor(Date.now() / 1000)
    
    const existing = await database
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1)
    
    if (existing.length > 0) {
      // Update existing setting
      await database
        .update(settings)
        .set({
          value,
          type,
          updatedAt: now,
        })
        .where(eq(settings.key, key))
    } else {
      // Create new setting
      await database.insert(settings).values({
        key,
        value,
        type,
        description: `${key} setting`,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  // GET /api/admin/settings - Get system settings
  app.get('/', requireAdmin(database), async (c) => {
    try {
      // Get all settings
      const allSettings = await database.select().from(settings)
      
      // Parse settings into structured format
      const settingsMap = new Map<string, string>()
      allSettings.forEach(setting => {
        if (setting.value) {
          settingsMap.set(setting.key, setting.value)
        }
      })

      // Structure response according to API design
      const response = {
        site: {
          title: settingsMap.get('site_title') || 'Magpie',
          description: settingsMap.get('site_description') || '收集和分享有趣的链接',
          aboutUrl: settingsMap.get('about_url') || '',
        },
        ai: {
          apiKey: settingsMap.get('openai_api_key') || '',
          baseUrl: settingsMap.get('openai_base_url') || 'https://api.openai.com/v1',
          model: settingsMap.get('ai_model') || 'gpt-3.5-turbo',
          temperature: parseFloat(settingsMap.get('ai_temperature') || '0.7'),
          summaryPrompt: settingsMap.get('ai_summary_prompt') || '',
          categoryPrompt: settingsMap.get('ai_category_prompt') || '',
        },
        content: {
          defaultCategory: settingsMap.get('default_category') || '其他',
          categories: JSON.parse(settingsMap.get('categories') || '["技术", "设计", "产品", "工具", "其他"]'),
          itemsPerPage: parseInt(settingsMap.get('items_per_page') || '20'),
        },
      }

      return sendSuccess(c, response, 'Settings retrieved successfully')
    } catch (error) {
      console.error('Failed to get settings:', error)
      return sendError(c, 'DATABASE_ERROR', 'Failed to retrieve settings', undefined, 500)
    }
  })

  // PUT /api/admin/settings - Update system settings
  app.put('/', requireAdmin(database), zValidator('json', updateSettingsSchema), async (c) => {
    try {
      const updates = c.req.valid('json')

      // Update site settings
      if (updates.site) {
        if (updates.site.title !== undefined) {
          await setSetting('site_title', updates.site.title)
        }
        if (updates.site.description !== undefined) {
          await setSetting('site_description', updates.site.description)
        }
        if (updates.site.aboutUrl !== undefined) {
          await setSetting('about_url', updates.site.aboutUrl)
        }
      }

      // Update AI settings
      if (updates.ai) {
        if (updates.ai.apiKey !== undefined) {
          await setSetting('openai_api_key', updates.ai.apiKey)
        }
        if (updates.ai.baseUrl !== undefined) {
          await setSetting('openai_base_url', updates.ai.baseUrl)
        }
        if (updates.ai.model !== undefined) {
          await setSetting('ai_model', updates.ai.model)
        }
        if (updates.ai.temperature !== undefined) {
          await setSetting('ai_temperature', updates.ai.temperature.toString(), 'number')
        }
        if (updates.ai.summaryPrompt !== undefined) {
          await setSetting('ai_summary_prompt', updates.ai.summaryPrompt)
        }
        if (updates.ai.categoryPrompt !== undefined) {
          await setSetting('ai_category_prompt', updates.ai.categoryPrompt)
        }
      }

      // Update content settings
      if (updates.content) {
        if (updates.content.defaultCategory !== undefined) {
          // Validate that the default category exists and is active
          const { categories } = await import('../../db/schema.js')
          const { eq } = await import('drizzle-orm')
          
          const categoryExists = await database
            .select()
            .from(categories)
            .where(eq(categories.name, updates.content.defaultCategory))
            .limit(1)
          
          if (categoryExists.length === 0) {
            return sendError(c, 'INVALID_DEFAULT_CATEGORY', 'Default category does not exist', undefined, 400)
          }
          
          if (categoryExists[0].isActive !== 1) {
            return sendError(c, 'INACTIVE_DEFAULT_CATEGORY', 'Default category must be active', undefined, 400)
          }
          
          await setSetting('default_category', updates.content.defaultCategory)
        }
        if (updates.content.categories !== undefined) {
          await setSetting('categories', JSON.stringify(updates.content.categories), 'json')
        }
        if (updates.content.itemsPerPage !== undefined) {
          await setSetting('items_per_page', updates.content.itemsPerPage.toString(), 'number')
        }
      }

      return sendSuccess(c, { updated: true }, 'Settings updated successfully')
    } catch (error) {
      console.error('Failed to update settings:', error)
      return sendError(c, 'DATABASE_ERROR', 'Failed to update settings', undefined, 500)
    }
  })

  // POST /api/admin/settings/ai/test - Test AI connection
  app.post('/ai/test', requireAdmin(database), async (c) => {
    try {
      const startTime = Date.now()
      
      // Check if we have test config in request body
      let testConfig = null
      try {
        const body = await c.req.json()
        testConfig = body?.testConfig
      } catch {
        // No body or invalid JSON, use saved settings
      }
      
      let aiSettings
      if (testConfig) {
        // Use test config from request
        aiSettings = {
          openai_api_key: testConfig.apiKey,
          openai_base_url: testConfig.baseUrl || 'https://api.openai.com/v1',
          ai_model: testConfig.model || 'gpt-3.5-turbo',
          ai_temperature: testConfig.temperature || 0.7,
          ai_max_tokens: 1000,
          ai_timeout: 30000,
          ai_prompt_template: testConfig.summaryPrompt || '',
          categories: '[]' // Use empty array for test
        }
      } else {
        // Use saved settings from database
        aiSettings = await getSettings(database)
      }

      if (!aiSettings.openai_api_key) {
        return sendError(c, 'AI_SERVICE_ERROR', 'AI API key not configured', undefined, 400)
      }

      // Test AI connection and analysis
      try {
        const aiAnalyzer = await createAIAnalyzer(aiSettings)
        
        // Test connection
        const connected = await aiAnalyzer.testConnection()
        
        if (!connected) {
          return sendError(c, 'AI_SERVICE_ERROR', 'AI service connection failed', undefined, 500)
        }

        // Test analysis with sample content
        const sampleContent = {
          url: 'https://example.com/test-article',
          contentType: 'article' as const,
          title: 'Test AI Analysis',
          description: 'This is a test article for AI analysis capabilities.',
          content: 'This article tests the AI analysis service. It covers various topics including technology, programming, and artificial intelligence to demonstrate the categorization and tagging features.',
          wordCount: 27,
          language: 'en'
        }

        const analysisResult = await aiAnalyzer.analyze(sampleContent)
        const responseTime = Date.now() - startTime

        const testResult = {
          connected: true,
          model: aiSettings.ai_model || 'gpt-3.5-turbo',
          baseUrl: aiSettings.openai_base_url || 'https://api.openai.com/v1',
          responseTime,
          testAnalysis: {
            summary: analysisResult.summary,
            category: analysisResult.category,
            tags: analysisResult.tags,
            language: analysisResult.language,
            sentiment: analysisResult.sentiment,
            readingTime: analysisResult.readingTime
          }
        }

        return sendSuccess(c, testResult, 'AI connection and analysis test completed successfully')
      } catch (aiError) {
        console.error('AI service test failed:', aiError)
        const responseTime = Date.now() - startTime
        
        return sendError(c, 'AI_SERVICE_ERROR', `AI service test failed: ${String(aiError)}`, {
          responseTime,
          model: aiSettings.ai_model || 'gpt-3.5-turbo',
          baseUrl: aiSettings.openai_base_url || 'https://api.openai.com/v1'
        }, 500)
      }
    } catch (error) {
      console.error('AI connection test failed:', error)
      return sendError(c, 'AI_SERVICE_ERROR', 'AI connection test failed', undefined, 500)
    }
  })

  return app
}

// Export both the router factory and a default instance
export { createAdminSettingsRouter }
export default createAdminSettingsRouter()