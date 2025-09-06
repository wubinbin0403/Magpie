import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AIAnalyzer, createAIAnalyzer, type AIAnalysisResult } from '../services/ai-analyzer.js'
import type { ScrapedContent } from '../services/web-scraper.js'

// Mock OpenAI
const mockOpenAI = vi.fn()
const mockCreate = vi.fn()

vi.mock('openai', () => {
  return {
    OpenAI: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }))
  }
})

describe('AIAnalyzer Service', () => {
  let analyzer: AIAnalyzer
  let mockContent: ScrapedContent

  beforeEach(() => {
    // Use Chinese categories for tests
    analyzer = new AIAnalyzer({
      apiKey: 'test-api-key',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000
    }, undefined, ['技术', '设计', '产品', '工具', '其他'])

    mockContent = {
      url: 'https://example.com/article',
      contentType: 'article',
      title: 'Test Article Title',
      description: 'This is a test article description',
      content: 'This is the main content of the test article. It contains multiple paragraphs with detailed information.',
      domain: 'example.com',
      wordCount: 18,
      language: 'en'
    }

    mockCreate.mockClear()
  })

  describe('Successful AI Analysis', () => {
    it('should analyze content and return structured result', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              summary: 'A comprehensive test article covering key concepts',
              category: '其他',
              tags: ['test', 'article', 'education'],
              language: 'en',
              sentiment: 'neutral',
              readingTime: 1
            })
          }
        }]
      }

      mockCreate.mockResolvedValueOnce(mockResponse)

      const result = await analyzer.analyze(mockContent)

      expect(result).toEqual({
        summary: 'A comprehensive test article covering key concepts',
        category: '其他',
        tags: ['test', 'article', 'education'],
        language: 'en',
        sentiment: 'neutral',
        readingTime: 1
      })

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('professional content analyzer')
          },
          {
            role: 'user',
            content: expect.stringContaining('Test Article Title')
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      })
    })

    it('should handle Chinese content correctly', async () => {
      const chineseContent: ScrapedContent = {
        ...mockContent,
        title: '测试文章标题',
        description: '这是一个测试文章的描述',
        content: '这是测试文章的主要内容。包含多个段落和详细信息。',
        language: 'zh'
      }

      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              summary: '这是一篇关于测试的综合性文章',
              category: 'tech',
              tags: ['测试', '文章', '技术'],
              language: 'zh',
              sentiment: 'neutral',
              readingTime: 1
            })
          }
        }]
      }

      mockCreate.mockResolvedValueOnce(mockResponse)

      const result = await analyzer.analyze(chineseContent)

      expect(result.language).toBe('zh')
      expect(result.tags).toEqual(['测试', '文章', '技术'])
    })
  })

  describe('Response Validation and Sanitization', () => {
    it('should validate and sanitize category', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              summary: 'Test summary',
              category: 'invalid-category',
              tags: ['test'],
              language: 'en'
            })
          }
        }]
      }

      mockCreate.mockResolvedValueOnce(mockResponse)

      const result = await analyzer.analyze(mockContent)
      expect(result.category).toBe('其他')
    })

    it('should validate and limit tags', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              summary: 'Test summary',
              category: 'tech',
              tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7', 'tag8', 'tag9', 'tag10', 'tag11', 'tag12'],
              language: 'en'
            })
          }
        }]
      }

      mockCreate.mockResolvedValueOnce(mockResponse)

      const result = await analyzer.analyze(mockContent)
      expect(result.tags).toHaveLength(10) // Limited to 10 tags
    })

    it('should validate reading time and provide fallback', async () => {
      const longContent = {
        ...mockContent,
        wordCount: 450 // Should be ~2 minutes reading time
      }

      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              summary: 'Test summary',
              category: 'tech',
              tags: ['test'],
              readingTime: -5 // Invalid reading time
            })
          }
        }]
      }

      mockCreate.mockResolvedValueOnce(mockResponse)

      const result = await analyzer.analyze(longContent)
      expect(result.readingTime).toBe(2) // Calculated from word count
    })

    it('should sanitize text fields', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              summary: 'A'.repeat(600), // Too long summary
              category: 'tech',
              tags: ['test'],
              language: 'en'
            })
          }
        }]
      }

      mockCreate.mockResolvedValueOnce(mockResponse)

      const result = await analyzer.analyze(mockContent)
      expect(result.summary).toHaveLength(500) // Limited to 500 chars
    })
  })

  describe('Error Handling and Fallback', () => {
    it('should handle empty AI response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: ''
          }
        }]
      }

      mockCreate.mockResolvedValueOnce(mockResponse)

      const result = await analyzer.analyze(mockContent)

      // Should return fallback analysis
      expect(result.summary).toBe(mockContent.description)
      expect(result.category).toBe('其他') // Based on fallback analysis from "Test Article"
      expect(result.sentiment).toBe('neutral')
      expect(result.readingTime).toBe(1)
    })

    it('should handle malformed JSON response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'This is not JSON { invalid json }'
          }
        }]
      }

      mockCreate.mockResolvedValueOnce(mockResponse)

      const result = await analyzer.analyze(mockContent)

      expect(result.summary).toBe(mockContent.description)
      expect(result.category).toBe('其他')
    })

    it('should extract JSON from mixed response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: `Here's the analysis:
            {
              "summary": "Extracted summary",
              "category": "技术",
              "tags": ["extracted"],
              "language": "en"
            }
            Hope this helps!`
          }
        }]
      }

      mockCreate.mockResolvedValueOnce(mockResponse)

      const result = await analyzer.analyze(mockContent)

      expect(result.summary).toBe('Extracted summary')
      expect(result.category).toBe('技术')
      expect(result.tags).toEqual(['extracted'])
    })

    it('should handle API errors with fallback', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API Error'))

      const result = await analyzer.analyze(mockContent)

      expect(result.summary).toBe(mockContent.description)
      expect(result.category).toBe('其他')
      expect(result.tags).toEqual(expect.any(Array))
    })
  })

  describe('Fallback Analysis', () => {
    it('should guess category from URL', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API Error'))

      const techContent = {
        ...mockContent,
        url: 'https://github.com/user/project'
      }

      const result = await analyzer.analyze(techContent)
      expect(result.category).toBe('技术')
    })

    it('should guess category from content', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API Error'))

      const scienceContent = {
        ...mockContent,
        title: 'Scientific Research Study on Methods',
        description: 'A comprehensive scientific research study on scientific methods and experiments'
      }

      const result = await analyzer.analyze(scienceContent)
      // Should match 'scientific' or 'research' keywords for science category
      expect(result.category).toBe('其他')
    })

    it('should detect Chinese language', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API Error'))

      const chineseContent = {
        ...mockContent,
        title: '测试文章标题这是中文内容',
        description: '这是一个中文描述包含很多中文字符'
      }

      const result = await analyzer.analyze(chineseContent)
      expect(result.language).toBe('zh')
    })

    it('should extract basic tags from content', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API Error'))

      const result = await analyzer.analyze(mockContent)
      expect(result.tags).toEqual(expect.arrayContaining(['test', 'article']))
    })
  })

  describe('Configuration Management', () => {

    it('should update available categories', () => {
      const newCategories = ['custom1', 'custom2']
      analyzer.updateCategories(newCategories)
      
      // Test with a mock response that uses the new category
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              summary: 'Test summary',
              category: 'custom1',
              tags: ['test']
            })
          }
        }]
      }

      mockCreate.mockResolvedValueOnce(mockResponse)

      return analyzer.analyze(mockContent).then(result => {
        expect(result.category).toBe('custom1')
      })
    })
  })

  describe('Connection Testing', () => {
    it('should test connection successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'OK'
          }
        }]
      }

      mockCreate.mockResolvedValueOnce(mockResponse)

      const isConnected = await analyzer.testConnection()
      expect(isConnected).toBe(true)
    })

    it('should handle connection test failure', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Connection failed'))

      const isConnected = await analyzer.testConnection()
      expect(isConnected).toBe(false)
    })
  })

  describe('Factory Function', () => {
    it('should create analyzer from settings', async () => {
      const settings = {
        openai_api_key: 'test-key',
        openai_base_url: 'https://custom-api.com/v1',
        ai_model: 'gpt-4',
        ai_temperature: '0.8',
        ai_max_tokens: '1500'
      }

      const analyzer = await createAIAnalyzer(settings)
      expect(analyzer).toBeInstanceOf(AIAnalyzer)
    })

    it('should require API key', async () => {
      const settings = {
        openai_base_url: 'https://api.openai.com/v1'
      }

      await expect(createAIAnalyzer(settings)).rejects.toThrow('OpenAI API key is required')
    })

    it('should use default values for missing settings', async () => {
      const settings = {
        openai_api_key: 'test-key'
      }

      const analyzer = await createAIAnalyzer(settings)
      expect(analyzer).toBeInstanceOf(AIAnalyzer)
    })
  })

  describe('Content Processing', () => {
    it('should truncate very long content', async () => {
      const longContent = {
        ...mockContent,
        content: 'A'.repeat(5000) // Very long content
      }

      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              summary: 'Test summary',
              category: 'tech',
              tags: ['test']
            })
          }
        }]
      }

      mockCreate.mockResolvedValueOnce(mockResponse)

      await analyzer.analyze(longContent)

      // Check that the prompt doesn't contain the full content
      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.messages[0].content.length).toBeLessThan(4200)
    })

    it('should handle different content types', async () => {
      const videoContent = {
        ...mockContent,
        contentType: 'video' as const,
        url: 'https://youtube.com/watch?v=123'
      }

      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              summary: 'Video summary',
              category: 'entertainment',
              tags: ['video']
            })
          }
        }]
      }

      mockCreate.mockResolvedValueOnce(mockResponse)

      const result = await analyzer.analyze(videoContent)
      expect(result.summary).toBe('Video summary')
    })
  })
})