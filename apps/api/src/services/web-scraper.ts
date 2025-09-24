import { JSDOM } from 'jsdom'
import { scraperLogger } from '../utils/logger.js'

export interface ScrapedContent {
  url: string
  title: string
  description: string
  content: string
  domain: string
  author?: string
  publishDate?: string
  siteName?: string
  contentType: 'article' | 'video' | 'pdf' | 'image' | 'other'
  language?: string
  tags?: string[]
  wordCount: number
}

export interface ScrapeOptions {
  maxContentLength?: number
  userAgent?: string
  timeout?: number
}

const DEFAULT_OPTIONS: Required<ScrapeOptions> = {
  maxContentLength: 10000,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  timeout: 10000
}

export class WebScraper {
  private options: Required<ScrapeOptions>

  constructor(options: ScrapeOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  async scrape(url: string): Promise<ScrapedContent> {
    try {
      // Validate URL
      const urlObj = new URL(url)
      
      // Determine content type from URL
      const contentType = this.determineContentType(url)
      
      // Fetch the webpage
      const html = await this.fetchHtml(url)
      
      // Parse with JSDOM
      const dom = new JSDOM(html, { url })
      const document = dom.window.document
      
      // Extract content based on type
      const content = await this.extractContent(document, contentType, url)
      
    const result = {
      url,
      contentType,
      domain: urlObj.hostname,
      ...content
    }
     
    return result
  } catch (error) {
      scraperLogger.error('Web scraper failed', {
        url,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
      throw new Error(`Failed to scrape content from ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

  private async fetchHtml(url: string): Promise<string> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout)

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.options.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const html = await response.text()
      return html
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.options.timeout}ms`)
      }
      throw error
    }
  }

  private determineContentType(url: string): ScrapedContent['contentType'] {
    const urlLower = url.toLowerCase()
    
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be') || 
        urlLower.includes('vimeo.com') || urlLower.includes('bilibili.com')) {
      return 'video'
    }
    
    if (urlLower.endsWith('.pdf')) {
      return 'pdf'
    }
    
    if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
      return 'image'
    }
    
    return 'article'
  }

  private async extractContent(document: Document, contentType: ScrapedContent['contentType'], url: string): Promise<Omit<ScrapedContent, 'url' | 'contentType' | 'domain'>> {
    switch (contentType) {
      case 'article':
        return this.extractArticleContent(document, url)
      case 'video':
        return this.extractVideoContent(document, url)
      case 'pdf':
        return this.extractPdfContent(document, url)
      case 'image':
        return this.extractImageContent(document, url)
      default:
        return this.extractGenericContent(document, url)
    }
  }

  private extractArticleContent(document: Document, url: string): Omit<ScrapedContent, 'url' | 'contentType'> {
    // Extract title (multiple fallback strategies)
    const title = this.extractTitle(document)
    
    // Extract meta description
    const description = this.extractDescription(document)
    
    // Extract main content
    const content = this.extractMainContent(document)
    
    // Extract additional metadata
    const author = this.extractAuthor(document)
    const publishDate = this.extractPublishDate(document)
    const siteName = this.extractSiteName(document)
    const language = this.extractLanguage(document)
    const tags = this.extractTags(document)
    
    const urlObj = new URL(url)
    
    return {
      domain: urlObj.hostname,
      title: this.cleanText(title),
      description: this.cleanText(description),
      content: this.cleanText(content, this.options.maxContentLength),
      author: author ? this.cleanText(author) : undefined,
      publishDate,
      siteName: siteName ? this.cleanText(siteName) : undefined,
      language,
      tags: tags?.map(tag => this.cleanText(tag)),
      wordCount: this.countWords(content)
    }
  }

  private extractVideoContent(document: Document, url: string): Omit<ScrapedContent, 'url' | 'contentType'> {
    const title = this.extractTitle(document)
    const description = this.extractDescription(document)
    
    // For videos, try to extract video-specific metadata
    let content = description
    
    // YouTube specific
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoDescription = document.querySelector('#meta-contents #description-text')?.textContent || 
                              document.querySelector('[data-testid="video-description"]')?.textContent ||
                              document.querySelector('.video-description')?.textContent
      if (videoDescription) {
        content = videoDescription
      }
    }
    
    // Bilibili specific  
    if (url.includes('bilibili.com')) {
      const videoIntro = document.querySelector('.video-desc .intro')?.textContent || 
                        document.querySelector('.video-info .desc')?.textContent
      if (videoIntro) {
        content = videoIntro
      }
    }
    
    const urlObj = new URL(url)
    
    return {
      domain: urlObj.hostname,
      title: this.cleanText(title),
      description: this.cleanText(description),
      content: this.cleanText(content, this.options.maxContentLength),
      siteName: this.extractSiteName(document),
      language: this.extractLanguage(document),
      wordCount: this.countWords(content)
    }
  }

  private extractPdfContent(document: Document, url: string): Omit<ScrapedContent, 'url' | 'contentType'> {
    // For PDFs, we can only extract metadata from the page that links to it
    const title = this.extractTitle(document) || url.split('/').pop()?.replace('.pdf', '') || 'PDF Document'
    const description = this.extractDescription(document) || 'PDF document'
    
    const urlObj = new URL(url)
    
    return {
      domain: urlObj.hostname,
      title: this.cleanText(title),
      description: this.cleanText(description),
      content: this.cleanText(description),
      wordCount: this.countWords(description)
    }
  }

  private extractImageContent(document: Document, url: string): Omit<ScrapedContent, 'url' | 'contentType'> {
    const title = this.extractTitle(document) || url.split('/').pop() || 'Image'
    const description = this.extractDescription(document) || 'Image content'
    
    const urlObj = new URL(url)
    
    return {
      domain: urlObj.hostname,
      title: this.cleanText(title),
      description: this.cleanText(description),
      content: this.cleanText(description),
      wordCount: this.countWords(description)
    }
  }

  private extractGenericContent(document: Document, url: string): Omit<ScrapedContent, 'url' | 'contentType'> {
    const urlObj = new URL(url)
    
    return {
      domain: urlObj.hostname,
      title: this.cleanText(this.extractTitle(document)),
      description: this.cleanText(this.extractDescription(document)),
      content: this.cleanText(this.extractMainContent(document), this.options.maxContentLength),
      siteName: this.extractSiteName(document),
      language: this.extractLanguage(document),
      wordCount: this.countWords(this.extractMainContent(document))
    }
  }

  private extractTitle(document: Document): string {
    // Try multiple strategies for title extraction
    return document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
           document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ||
           document.title ||
           document.querySelector('h1')?.textContent ||
           document.querySelector('h2')?.textContent ||
           'Untitled'
  }

  private extractDescription(document: Document): string {
    return document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
           document.querySelector('meta[name="twitter:description"]')?.getAttribute('content') ||
           document.querySelector('meta[name="description"]')?.getAttribute('content') ||
           document.querySelector('meta[property="description"]')?.getAttribute('content') ||
           'No description available'
  }

  private extractMainContent(document: Document): string {
    // Clone document to avoid modifying original
    const bodyClone = document.body.cloneNode(true) as HTMLElement
    
    // Remove unwanted elements
    const unwantedSelectors = 'script, style, nav, header, footer, aside, .sidebar, .navigation, .menu, .ads, .advertisement'
    bodyClone.querySelectorAll(unwantedSelectors).forEach(el => el.remove())
    
    // Try common content selectors (in order of preference)
    const contentSelectors = [
      'article',
      '.post-content',
      '.entry-content', 
      '.content',
      '.main-content',
      '.article-content',
      '.post-body',
      '.entry',
      '.post',
      'main',
      '.container .content',
      '#content',
      '#main',
      '.article',
      '.blog-post',
      '.tutorial-content',
      '[role="main"]',
      '.page-content'
    ]
    
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector)
      if (element) {
        const text = element.textContent?.trim() || ''
        if (text.length > 200) { // Only use if substantial content
          return text
        }
      }
    }
    
    // Fallback: extract from cloned body
    bodyClone.querySelectorAll('.comments, .social-share').forEach(el => el.remove())
    return bodyClone.textContent?.trim() || ''
  }

  private extractAuthor(document: Document): string | undefined {
    const author = document.querySelector('meta[name="author"]')?.getAttribute('content') ||
                  document.querySelector('meta[property="article:author"]')?.getAttribute('content') ||
                  document.querySelector('.author')?.textContent ||
                  document.querySelector('.byline')?.textContent ||
                  document.querySelector('[rel="author"]')?.textContent
    
    return author?.trim() || undefined
  }

  private extractPublishDate(document: Document): string | undefined {
    const dateStr = document.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ||
                   document.querySelector('meta[name="publishdate"]')?.getAttribute('content') ||
                   document.querySelector('time[datetime]')?.getAttribute('datetime') ||
                   document.querySelector('.date')?.textContent ||
                   document.querySelector('.published')?.textContent
    
    if (!dateStr) return undefined
    
    try {
      const date = new Date(dateStr)
      return isNaN(date.getTime()) ? undefined : date.toISOString()
    } catch {
      return undefined
    }
  }

  private extractSiteName(document: Document): string | undefined {
    return document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
           document.querySelector('meta[name="application-name"]')?.getAttribute('content') ||
           undefined
  }

  private extractLanguage(document: Document): string | undefined {
    return document.documentElement.getAttribute('lang') ||
           document.querySelector('meta[http-equiv="content-language"]')?.getAttribute('content') ||
           undefined
  }

  private extractTags(document: Document): string[] | undefined {
    const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content')
    if (keywords) {
      return keywords.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
    }
    
    // Try to extract from article tags or categories
    const tags: string[] = []
    document.querySelectorAll('.tag, .category, .label').forEach(element => {
      const tagText = element.textContent?.trim()
      if (tagText) {
        tags.push(tagText)
      }
    })
    
    return tags.length > 0 ? tags : undefined
  }

  private cleanText(text: string, maxLength?: number): string {
    if (!text) return ''
    
    // Remove extra whitespace and normalize
    let cleaned = text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n') // Replace multiple newlines with single newline
      .trim()
    
    // Truncate if needed
    if (maxLength && cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength).trim()
      // Try to cut at word boundary
      const lastSpaceIndex = cleaned.lastIndexOf(' ')
      if (lastSpaceIndex > maxLength * 0.8) {
        cleaned = cleaned.substring(0, lastSpaceIndex)
      }
      cleaned += '...'
    }
    
    return cleaned
  }

  private countWords(text: string): number {
    if (!text) return 0
    
    // Count CJK characters (Chinese, Japanese Kanji/Hiragana/Katakana, Korean)
    const cjkPattern = /[\u4e00-\u9fff\u3040-\u30ff\u31f0-\u31ff\uac00-\ud7af]/g
    const cjkMatches = text.match(cjkPattern) || []
    const cjkCount = cjkMatches.length
    
    // Remove CJK characters and count regular words
    const textWithoutCJK = text.replace(cjkPattern, ' ')
    
    // Count words for non-CJK text (English, etc.)
    const words = textWithoutCJK
      .replace(/[^\w\s]/g, ' ') // Keep only word characters and spaces
      .split(/\s+/)
      .filter(word => word.length > 0)
    const wordCount = words.length
    
    // For reading time estimation:
    // - CJK characters: ~500 characters per minute
    // - English words: ~225-265 words per minute
    // We normalize CJK characters to "word equivalents" for consistent calculation
    // Using 2.2 as conversion factor (500 CPM / 225 WPM ≈ 2.2)
    const cjkWordEquivalent = Math.ceil(cjkCount / 2.2)
    
    return wordCount + cjkWordEquivalent
  }
}

// Export default instance
export const webScraper = new WebScraper()

// Export factory function for custom configurations
export function createWebScraper(options?: ScrapeOptions): WebScraper {
  return new WebScraper(options)
}
