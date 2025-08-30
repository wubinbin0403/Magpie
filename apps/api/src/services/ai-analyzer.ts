import { OpenAI } from 'openai'
import type { ScrapedContent } from './web-scraper.js'

export interface AIAnalysisResult {
  summary: string
  category: string
  tags: string[]
  language?: string
  sentiment?: 'positive' | 'neutral' | 'negative'
  readingTime?: number
}

export interface AIAnalyzerOptions {
  apiKey: string
  baseURL?: string
  model?: string
  temperature?: number
  maxTokens?: number
  timeout?: number
}

const DEFAULT_OPTIONS = {
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  maxTokens: 1000,
  timeout: 30000
}

// Default categories fallback (Chinese-focused)
const DEFAULT_CATEGORIES = [
  '技术', '设计', '产品', '工具', '其他'
]

// Default AI prompt template (optimized for Chinese content with dynamic categories)
const DEFAULT_PROMPT_TEMPLATE = `请分析以下网页内容，并以JSON格式提供结构化摘要。

内容信息：
- URL: {url}
- 标题: {title}
- 内容类型: {contentType}
- 原始描述: {description}
- 主要内容: {content}

请按以下JSON格式提供分析结果：
{
  "summary": "简洁明了的2-3句话摘要，使用与原内容相同的语言",
  "category": "从以下分类中选择最合适的一个：{categories}",
  "tags": ["3-5个相关标签的字符串数组"],
  "language": "检测到的语言代码(zh, en, ja等)",
  "sentiment": "positive, neutral, 或 negative",
  "readingTime": "预估阅读时间(分钟数，整数)"
}

分析要求：
- 摘要要简洁且信息丰富，突出核心观点
- 严格从给定的分类列表中选择最合适的一个分类
- 标签应该具体且相关，有助于内容检索
- 准确检测内容的主要语言
- 根据内容长度提供合理的阅读时间估算(按每分钟200-300字计算)
- 仅返回有效的JSON格式，不要添加其他文本`

export class AIAnalyzer {
  private client: OpenAI
  private options: Required<Omit<AIAnalyzerOptions, 'apiKey' | 'baseURL'>>
  private promptTemplate: string
  private availableCategories: string[]

  constructor(options: AIAnalyzerOptions, promptTemplate?: string, categories?: string[]) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
      timeout: options.timeout || DEFAULT_OPTIONS.timeout
    })
    
    this.options = {
      model: options.model || DEFAULT_OPTIONS.model,
      temperature: options.temperature || DEFAULT_OPTIONS.temperature,
      maxTokens: options.maxTokens || DEFAULT_OPTIONS.maxTokens,
      timeout: options.timeout || DEFAULT_OPTIONS.timeout
    }

    this.promptTemplate = promptTemplate || DEFAULT_PROMPT_TEMPLATE
    this.availableCategories = categories || DEFAULT_CATEGORIES
  }

  async analyze(content: ScrapedContent): Promise<AIAnalysisResult> {
    try {
      // Prepare content for AI analysis
      const prompt = this.buildPrompt(content)
      
      // Call OpenAI API
      const response = await this.client.chat.completions.create({
        model: this.options.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: this.options.temperature,
        max_tokens: this.options.maxTokens,
      })

      const aiResponse = response.choices[0]?.message?.content?.trim()
      
      if (!aiResponse) {
        throw new Error('Empty response from AI service')
      }

      // Parse JSON response
      let analysisResult: AIAnalysisResult
      try {
        analysisResult = JSON.parse(aiResponse)
      } catch (parseError) {
        console.warn('Failed to parse AI JSON response, attempting to extract:', aiResponse)
        analysisResult = this.extractAnalysisFromText(aiResponse, content)
      }

      // Validate and sanitize the result
      return this.validateAndSanitize(analysisResult, content)

    } catch (error) {
      console.error('AI analysis failed:', error)
      
      // Return fallback analysis
      return this.generateFallbackAnalysis(content)
    }
  }

  private buildPrompt(content: ScrapedContent): string {
    // Replace template variables
    return this.promptTemplate
      .replace('{url}', content.url)
      .replace('{title}', content.title || 'No title')
      .replace('{contentType}', content.contentType)
      .replace('{description}', content.description || 'No description')
      .replace('{content}', this.truncateContent(content.content))
      .replace('{categories}', this.availableCategories.join('、'))
  }

  private truncateContent(text: string, maxLength: number = 3000): string {
    if (text.length <= maxLength) {
      return text
    }
    
    // Try to cut at sentence boundary
    const truncated = text.substring(0, maxLength)
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?'),
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf('！'),
      truncated.lastIndexOf('？')
    )
    
    if (lastSentenceEnd > maxLength * 0.8) {
      return truncated.substring(0, lastSentenceEnd + 1)
    }
    
    return truncated + '...'
  }

  private extractAnalysisFromText(text: string, content: ScrapedContent): AIAnalysisResult {
    // Try to extract JSON from text that might have extra content
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0])
      } catch {
        // Continue to fallback
      }
    }
    
    // If JSON extraction fails, generate fallback
    return this.generateFallbackAnalysis(content)
  }

  private validateAndSanitize(result: AIAnalysisResult, content: ScrapedContent): AIAnalysisResult {
    // Validate required fields
    const sanitized: AIAnalysisResult = {
      summary: this.sanitizeText(result.summary) || content.description || 'Content summary not available',
      category: this.validateCategory(result.category),
      tags: this.validateTags(result.tags),
      language: this.validateLanguage(result.language || content.language),
      sentiment: this.validateSentiment(result.sentiment),
      readingTime: this.validateReadingTime(result.readingTime, content.wordCount)
    }

    return sanitized
  }

  private sanitizeText(text: any): string {
    if (typeof text !== 'string') return ''
    return text.trim().substring(0, 500) // Limit length
  }

  private validateCategory(category: any): string {
    if (typeof category === 'string') {
      // Try exact match first (for Chinese categories)
      if (this.availableCategories.includes(category)) {
        return category
      }
      // Try lowercase match (for English categories)
      if (this.availableCategories.includes(category.toLowerCase())) {
        return category.toLowerCase()
      }
    }
    // Return fallback category (usually "其他")
    return this.availableCategories.includes('其他') ? '其他' : this.availableCategories[this.availableCategories.length - 1]
  }

  private validateTags(tags: any): string[] {
    if (!Array.isArray(tags)) return []
    
    return tags
      .filter(tag => typeof tag === 'string')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0 && tag.length <= 50)
      .slice(0, 10) // Limit to 10 tags
  }

  private validateLanguage(language: any): string | undefined {
    if (typeof language !== 'string') return undefined
    
    // Common language codes
    const validLanguages = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'ar', 'hi']
    const lang = language.toLowerCase().substring(0, 2)
    
    return validLanguages.includes(lang) ? lang : 'en'
  }

  private validateSentiment(sentiment: any): 'positive' | 'neutral' | 'negative' | undefined {
    if (sentiment === 'positive' || sentiment === 'neutral' || sentiment === 'negative') {
      return sentiment
    }
    return 'neutral'
  }

  private validateReadingTime(readingTime: any, wordCount: number): number | undefined {
    // Estimate reading time: average 200-250 words per minute
    const estimatedTime = Math.ceil(wordCount / 225)
    
    if (typeof readingTime === 'number' && readingTime > 0 && readingTime <= 60) {
      return readingTime
    }
    
    return estimatedTime > 0 ? estimatedTime : 1
  }

  private generateFallbackAnalysis(content: ScrapedContent): AIAnalysisResult {
    // Generate basic analysis when AI fails
    // First try content-based detection, then URL-based
    let category = this.guessCategoryFromContent(content.title, content.description)
    if (category === (this.availableCategories.includes('其他') ? '其他' : this.availableCategories[this.availableCategories.length - 1])) {
      category = this.guessCategoryFromUrl(content.url)
    }
    const tags = this.extractBasicTags(content.title, content.description)
    const language = this.detectLanguage(content.title + ' ' + content.description)
    
    return {
      summary: content.description || content.title || 'Content analysis not available',
      category,
      tags,
      language,
      sentiment: 'neutral',
      readingTime: Math.max(1, Math.ceil(content.wordCount / 225))
    }
  }

  private guessCategoryFromUrl(url: string): string {
    const urlLower = url.toLowerCase()
    
    // Map common URL patterns to Chinese categories
    if (this.availableCategories.includes('技术')) {
      if (urlLower.includes('tech') || urlLower.includes('programming') || urlLower.includes('software') || 
          urlLower.includes('github') || urlLower.includes('dev') || urlLower.includes('code') ||
          urlLower.includes('api') || urlLower.includes('framework')) {
        return '技术'
      }
    }
    
    if (this.availableCategories.includes('设计')) {
      if (urlLower.includes('design') || urlLower.includes('ui') || urlLower.includes('ux') || 
          urlLower.includes('figma') || urlLower.includes('dribbble') || urlLower.includes('behance')) {
        return '设计'
      }
    }
    
    if (this.availableCategories.includes('产品')) {
      if (urlLower.includes('product') || urlLower.includes('startup') || urlLower.includes('business') ||
          urlLower.includes('pm') || urlLower.includes('strategy')) {
        return '产品'
      }
    }
    
    if (this.availableCategories.includes('工具')) {
      if (urlLower.includes('tool') || urlLower.includes('app') || urlLower.includes('software') ||
          urlLower.includes('extension') || urlLower.includes('plugin') || urlLower.includes('utility')) {
        return '工具'
      }
    }
    
    // Return fallback category (usually "其他")
    return this.availableCategories.includes('其他') ? '其他' : this.availableCategories[this.availableCategories.length - 1]
  }

  private guessCategoryFromContent(title: string, description: string): string {
    const content = (title + ' ' + description).toLowerCase()
    
    // Map keywords to available Chinese categories
    const categoryKeywords = {
      '技术': ['technology', 'programming', 'software', 'code', 'api', 'framework', 'dev', 'tech', '技术', '编程', '软件', '代码', '开发'],
      '设计': ['design', 'ui', 'ux', 'visual', 'graphic', 'figma', '设计', '界面', '视觉'],
      '产品': ['product', 'startup', 'business', 'company', 'marketing', 'strategy', '产品', '商业', '创业', '营销'],
      '工具': ['tool', 'app', 'software', 'utility', 'plugin', 'extension', '工具', '应用', '插件']
    }
    
    // Check each available category
    for (const category of this.availableCategories) {
      if (category === '其他') continue // Skip "其他", it's the fallback
      
      const keywords = categoryKeywords[category as keyof typeof categoryKeywords]
      if (keywords && keywords.some(keyword => {
        // Use includes for Chinese characters, word boundary for English
        if (/[\u4e00-\u9fff]/.test(keyword)) {
          return content.includes(keyword)
        } else {
          const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
          return regex.test(content)
        }
      })) {
        return category
      }
    }
    
    // Return fallback category
    return this.availableCategories.includes('其他') ? '其他' : this.availableCategories[this.availableCategories.length - 1]
  }

  private extractBasicTags(title: string, description: string): string[] {
    const text = (title + ' ' + description).toLowerCase()
    const words = text.match(/\b\w{3,}\b/g) || []
    
    // Filter common words and get unique terms
    const commonWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'was', 'one', 'our', 'has', 'have',
      'this', 'that', 'with', 'they', 'will', 'been', 'said', 'each', 'which', 'their', 'time', 'from'
    ])
    
    const uniqueWords = [...new Set(words)]
      .filter(word => !commonWords.has(word) && word.length >= 3 && word.length <= 20)
      .slice(0, 5)
    
    return uniqueWords
  }

  private detectLanguage(text: string): string {
    // Simple language detection based on character patterns
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const japaneseChars = (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length
    const koreanChars = (text.match(/[\uac00-\ud7af]/g) || []).length
    
    const totalChars = text.length
    
    if (chineseChars / totalChars > 0.3) return 'zh'
    if (japaneseChars / totalChars > 0.3) return 'ja'
    if (koreanChars / totalChars > 0.3) return 'ko'
    
    return 'en'
  }

  // Update configuration
  updatePromptTemplate(template: string): void {
    this.promptTemplate = template
  }

  updateCategories(categories: string[]): void {
    this.availableCategories = categories
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.options.model,
        messages: [{ role: 'user', content: 'Reply with "OK"' }],
        max_tokens: 10,
        temperature: 0
      })
      
      return response.choices[0]?.message?.content?.trim()?.toLowerCase() === 'ok'
    } catch (error) {
      console.error('AI connection test failed:', error)
      return false
    }
  }
}

// Export factory function for creating analyzer with settings
export async function createAIAnalyzer(settings: Record<string, any>): Promise<AIAnalyzer> {
  const options: AIAnalyzerOptions = {
    apiKey: settings.openai_api_key || '',
    baseURL: settings.openai_base_url || 'https://api.openai.com/v1',
    model: settings.ai_model || 'gpt-3.5-turbo',
    temperature: parseFloat(settings.ai_temperature || '0.7'),
    maxTokens: parseInt(settings.ai_max_tokens || '1000'),
    timeout: parseInt(settings.ai_timeout || '30000')
  }

  if (!options.apiKey) {
    throw new Error('OpenAI API key is required')
  }

  const promptTemplate = settings.ai_prompt_template || undefined
  const categories = Array.isArray(settings.categories) ? settings.categories : 
                    (settings.categories ? JSON.parse(settings.categories) : undefined)

  return new AIAnalyzer(options, promptTemplate, categories)
}