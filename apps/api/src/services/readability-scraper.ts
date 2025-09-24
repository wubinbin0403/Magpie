import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import { scraperLogger } from '../utils/logger.js'
import type { ScrapedContent } from './web-scraper.js'

export interface ReadabilityScraperOptions {
  maxContentLength?: number
  userAgent?: string
  timeout?: number
  debug?: boolean
}

const DEFAULT_OPTIONS: Required<ReadabilityScraperOptions> = {
  maxContentLength: 10000,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  timeout: 10000,
  debug: false
}

export class ReadabilityScraper {
  private options: Required<ReadabilityScraperOptions>

  constructor(options: ReadabilityScraperOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  async scrape(url: string): Promise<ScrapedContent> {
    try {
      // Validate URL
      new URL(url)
      
      // Fetch the webpage
      const html = await this.fetchHtml(url)
      
      // Parse with JSDOM
      const dom = new JSDOM(html, { url })
      const document = dom.window.document
      
      // Use Readability to extract main content
      const reader = new Readability(document, {
        debug: this.options.debug,
        maxElemsToParse: 0, // No limit
        nbTopCandidates: 5,
        charThreshold: 500,
        classesToPreserve: ['highlight', 'code', 'syntax']
      })
      
      const article = reader.parse()
      
      if (!article) {
        // Fallback to basic extraction
        return this.fallbackExtraction(document, url)
      }
      
      // Extract additional metadata not provided by Readability
      const contentType = this.determineContentType(url)
      const author = this.extractAuthor(document) || article.byline
      const publishDate = this.extractPublishDate(document)
      const language = this.extractLanguage(document)
      const tags = this.extractTags(document)
      
      const urlObj = new URL(url)
      
      const result: ScrapedContent = {
        url,
        domain: urlObj.hostname,
        contentType,
        title: this.cleanText(article.title || this.extractTitle(document)),
        description: this.cleanText(this.extractDescription(document)),
        content: this.cleanText(article.textContent || '', this.options.maxContentLength),
        author: author ? this.cleanText(author) : undefined,
        publishDate,
        siteName: article.siteName || this.extractSiteName(document),
        language,
        tags: tags?.map(tag => this.cleanText(tag)),
        wordCount: this.countWords(article.textContent || '')
      }
      
      
      return result
      
    } catch (error) {
      scraperLogger.error('Readability scraper failed', {
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
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none'
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

  private fallbackExtraction(document: Document, url: string): ScrapedContent {
    const contentType = this.determineContentType(url)
    const title = this.extractTitle(document)
    const description = this.extractDescription(document)
    const content = this.extractGenericContent(document)
    
    const urlObj = new URL(url)
    
    return {
      url,
      domain: urlObj.hostname,
      contentType,
      title: this.cleanText(title),
      description: this.cleanText(description),
      content: this.cleanText(content, this.options.maxContentLength),
      author: this.extractAuthor(document) || undefined,
      publishDate: this.extractPublishDate(document),
      siteName: this.extractSiteName(document) || undefined,
      language: this.extractLanguage(document),
      tags: this.extractTags(document),
      wordCount: this.countWords(content)
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

  private extractTitle(document: Document): string {
    return document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
           document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ||
           document.title ||
           document.querySelector('h1')?.textContent ||
           'Untitled'
  }

  private extractDescription(document: Document): string {
    return document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
           document.querySelector('meta[name="twitter:description"]')?.getAttribute('content') ||
           document.querySelector('meta[name="description"]')?.getAttribute('content') ||
           'No description available'
  }

  private extractGenericContent(document: Document): string {
    // Remove script and style elements
    const elementsToRemove = document.querySelectorAll('script, style, nav, header, footer, aside')
    elementsToRemove.forEach(el => el.remove())
    
    // Try to find main content
    const contentElement = document.querySelector('main, article, .content, #content') || document.body
    return contentElement?.textContent || ''
  }

  private extractAuthor(document: Document): string | undefined {
    const author = document.querySelector('meta[name="author"]')?.getAttribute('content') ||
                  document.querySelector('meta[property="article:author"]')?.getAttribute('content') ||
                  document.querySelector('.author')?.textContent ||
                  document.querySelector('.byline')?.textContent ||
                  document.querySelector('[rel="author"]')?.textContent
    
    return author ? author.trim() : undefined
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
    
    // Try to extract from article tags
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
    
    let cleaned = text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim()
    
    if (maxLength && cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength).trim()
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
    
    const words = text
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0)
    
    return words.length
  }
}

// Export default instance
export const readabilityScraper = new ReadabilityScraper()

// Export factory function
export function createReadabilityScraper(options?: ReadabilityScraperOptions): ReadabilityScraper {
  return new ReadabilityScraper(options)
}
