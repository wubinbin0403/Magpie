import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { links, apiTokens, settings } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { createAddLinkRouter } from '../routes/auth/add-link.js'
import type { ScrapedContent } from '../services/web-scraper.js'
import type { AIAnalysisResult } from '../services/ai-analyzer.js'

// Mock web scraper
vi.mock('../services/web-scraper.js', () => ({
  webScraper: {
    scrape: vi.fn()
  }
}))

// Mock AI analyzer
vi.mock('../services/ai-analyzer.js', () => ({
  createAIAnalyzer: vi.fn(),
  AIAnalyzer: vi.fn()
}))

describe('Add Link Integration Tests', () => {
  let app: any
  let testToken: string
  let mockWebScraper: any
  let mockCreateAIAnalyzer: any

  beforeEach(async () => {
    clearTestData()
    
    // Use real router with test database injection
    app = createAddLinkRouter(testDrizzle)
    
    // Get mock functions
    const { webScraper } = await import('../services/web-scraper.js')
    const { createAIAnalyzer } = await import('../services/ai-analyzer.js')
    
    mockWebScraper = webScraper as any
    mockCreateAIAnalyzer = createAIAnalyzer as any
    
    // Reset mocks
    mockWebScraper.scrape.mockReset()
    mockCreateAIAnalyzer.mockReset()
    
    // Create test API token
    const now = Math.floor(Date.now() / 1000)
    testToken = 'mgp_' + '0'.repeat(64) // Valid format test token
    
    await testDrizzle.insert(apiTokens).values({
      token: testToken,
      name: 'Test Token',
      prefix: 'mgp_',
      status: 'active',
      usageCount: 0,
      createdAt: now,
    })
    
    // Initialize test settings
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
        key: 'categories',
        value: JSON.stringify(['tech', 'science', 'business', 'other']),
        type: 'json',
        description: 'Available categories',
        createdAt: now,
        updatedAt: now,
      }
    ])
  })

  describe('POST / with real content processing', () => {
    it('should successfully process URL with web scraping and AI analysis', async () => {
      // Mock scraped content
      const mockScrapedContent: ScrapedContent = {
        url: 'https://example.com/tech-article',
        contentType: 'article',
        title: 'Advanced JavaScript Techniques',
        description: 'Learn advanced JavaScript patterns and techniques',
        content: 'This article covers advanced JavaScript concepts including closures, promises, and async/await patterns.',
        wordCount: 150,
        language: 'en',
        author: 'John Doe',
        siteName: 'TechBlog'
      }
      
      // Mock AI analysis result
      const mockAIAnalysis: AIAnalysisResult = {
        summary: 'An in-depth guide to advanced JavaScript programming techniques and patterns.',
        category: 'tech',
        tags: ['javascript', 'programming', 'web-development'],
        language: 'en',
        sentiment: 'neutral',
        readingTime: 5
      }
      
      // Mock AI analyzer instance
      const mockAnalyzer = {
        analyze: vi.fn().mockResolvedValue(mockAIAnalysis)
      }
      
      // Setup mocks
      mockWebScraper.scrape.mockResolvedValue(mockScrapedContent)
      mockCreateAIAnalyzer.mockResolvedValue(mockAnalyzer)

      const response = await app.request('/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: 'https://example.com/tech-article',
          skipConfirm: true
        })
      })
      
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('published')
      expect(data.data.title).toBe('Advanced JavaScript Techniques')
      expect(data.data.category).toBe('tech')
      expect(data.data.tags).toEqual(['javascript', 'programming', 'web-development'])
      
      // Verify web scraper was called
      expect(mockWebScraper.scrape).toHaveBeenCalledWith('https://example.com/tech-article')
      
      // Verify AI analyzer was created and used
      expect(mockCreateAIAnalyzer).toHaveBeenCalled()
      expect(mockAnalyzer.analyze).toHaveBeenCalledWith(mockScrapedContent)
      
      // Verify data was saved to database
      const savedLink = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.id, data.data.id))
        .limit(1)
      
      expect(savedLink).toHaveLength(1)
      expect(savedLink[0].title).toBe('Advanced JavaScript Techniques')
      expect(savedLink[0].aiSummary).toBe('An in-depth guide to advanced JavaScript programming techniques and patterns.')
      expect(savedLink[0].aiCategory).toBe('tech')
      expect(JSON.parse(savedLink[0].aiTags || '[]')).toEqual(['javascript', 'programming', 'web-development'])
      expect(savedLink[0].status).toBe('published')
    })

    it('should handle web scraping failure', async () => {
      // Mock scraping failure
      mockWebScraper.scrape.mockRejectedValue(new Error('Failed to fetch page'))

      const response = await app.request('/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: 'https://invalid-url.com',
          skipConfirm: true
        })
      })
      
      const data = await response.json() as any

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('PROCESSING_ERROR')
      
      // Verify no link was created
      const linkCount = await testDrizzle.select().from(links)
      expect(linkCount).toHaveLength(0)
    })

    it('should fallback to basic analysis when AI fails', async () => {
      const mockScrapedContent: ScrapedContent = {
        url: 'https://example.com/article',
        contentType: 'article',
        title: 'Test Article',
        description: 'Test description',
        content: 'Test content',
        wordCount: 50,
        language: 'en'
      }
      
      // Mock successful scraping but AI failure
      mockWebScraper.scrape.mockResolvedValue(mockScrapedContent)
      mockCreateAIAnalyzer.mockRejectedValue(new Error('AI service unavailable'))

      const response = await app.request('/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: 'https://example.com/article',
          skipConfirm: true
        })
      })
      
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('published')
      expect(data.data.title).toBe('Test Article')
      expect(data.data.category).toBe('other') // Fallback category
      expect(data.data.tags).toEqual(['article']) // Fallback tags
      
      // Verify fallback data in database
      const savedLink = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.id, data.data.id))
        .limit(1)
      
      expect(savedLink[0].aiCategory).toBe('other')
      expect(JSON.parse(savedLink[0].aiTags || '[]')).toEqual(['article'])
    })

    it('should handle missing AI configuration gracefully', async () => {
      // Remove AI API key setting
      await testDrizzle
        .delete(settings)
        .where(eq(settings.key, 'openai_api_key'))
      
      const mockScrapedContent: ScrapedContent = {
        url: 'https://example.com/article',
        contentType: 'article',
        title: 'Test Article',
        description: 'Test description',
        content: 'Test content',
        wordCount: 50,
        language: 'en'
      }
      
      mockWebScraper.scrape.mockResolvedValue(mockScrapedContent)

      const response = await app.request('/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: 'https://example.com/article',
          skipConfirm: true
        })
      })
      
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('published')
      
      // Should use fallback analysis
      expect(data.data.category).toBe('other')
      expect(data.data.tags).toEqual(['article'])
    })

    it('should preserve original content for manual review when skipConfirm=false', async () => {
      const mockScrapedContent: ScrapedContent = {
        url: 'https://example.com/review-article',
        contentType: 'article',
        title: 'Article for Review',
        description: 'Article that needs review',
        content: 'Content to be reviewed',
        wordCount: 80,
        language: 'en'
      }
      
      const mockAIAnalysis: AIAnalysisResult = {
        summary: 'AI generated summary',
        category: 'tech',
        tags: ['review', 'pending'],
        language: 'en',
        sentiment: 'neutral',
        readingTime: 3
      }
      
      const mockAnalyzer = {
        analyze: vi.fn().mockResolvedValue(mockAIAnalysis)
      }
      
      mockWebScraper.scrape.mockResolvedValue(mockScrapedContent)
      mockCreateAIAnalyzer.mockResolvedValue(mockAnalyzer)

      const response = await app.request('/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          url: 'https://example.com/review-article',
          skipConfirm: false
        })
      })
      
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('pending')
      expect(data.data.confirmUrl).toBeDefined()
      
      // Verify pending link in database
      const savedLink = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.id, data.data.id))
        .limit(1)
      
      expect(savedLink[0].status).toBe('pending')
      expect(savedLink[0].originalContent).toBe('Content to be reviewed')
      expect(savedLink[0].aiSummary).toBe('AI generated summary')
      expect(savedLink[0].finalDescription).toBeNull() // Not set until confirmed
    })
  })
})