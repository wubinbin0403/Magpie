import * as cheerio from 'cheerio'

export interface ScrapedContent {
  url: string
  title: string
  description: string
  content: string
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
      
      // Parse with Cheerio
      const $ = cheerio.load(html)
      
      // Extract content based on type
      const content = await this.extractContent($, contentType, url)
      
      const result = {
        url,
        contentType,
        ...content
      }
      
      return result
    } catch (error) {
      console.error(`Error scraping ${url}:`, error)
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

  private async extractContent($: cheerio.CheerioAPI, contentType: ScrapedContent['contentType'], url: string): Promise<Omit<ScrapedContent, 'url' | 'contentType'>> {
    switch (contentType) {
      case 'article':
        return this.extractArticleContent($, url)
      case 'video':
        return this.extractVideoContent($, url)
      case 'pdf':
        return this.extractPdfContent($, url)
      case 'image':
        return this.extractImageContent($, url)
      default:
        return this.extractGenericContent($, url)
    }
  }

  private extractArticleContent($: cheerio.CheerioAPI, url: string): Omit<ScrapedContent, 'url' | 'contentType'> {
    // Extract title (multiple fallback strategies)
    const title = this.extractTitle($)
    
    // Extract meta description
    const description = this.extractDescription($)
    
    // Extract main content
    const content = this.extractMainContent($)
    
    // Extract additional metadata
    const author = this.extractAuthor($)
    const publishDate = this.extractPublishDate($)
    const siteName = this.extractSiteName($)
    const language = this.extractLanguage($)
    const tags = this.extractTags($)
    
    return {
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

  private extractVideoContent($: cheerio.CheerioAPI, url: string): Omit<ScrapedContent, 'url' | 'contentType'> {
    const title = this.extractTitle($)
    const description = this.extractDescription($)
    
    // For videos, try to extract video-specific metadata
    let content = description
    
    // YouTube specific
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoDescription = $('#meta-contents #description-text')?.text() || 
                              $('[data-testid="video-description"]')?.text() ||
                              $('.video-description')?.text()
      if (videoDescription) {
        content = videoDescription
      }
    }
    
    // Bilibili specific  
    if (url.includes('bilibili.com')) {
      const videoIntro = $('.video-desc .intro')?.text() || $('.video-info .desc')?.text()
      if (videoIntro) {
        content = videoIntro
      }
    }
    
    return {
      title: this.cleanText(title),
      description: this.cleanText(description),
      content: this.cleanText(content, this.options.maxContentLength),
      siteName: this.extractSiteName($),
      language: this.extractLanguage($),
      wordCount: this.countWords(content)
    }
  }

  private extractPdfContent($: cheerio.CheerioAPI, url: string): Omit<ScrapedContent, 'url' | 'contentType'> {
    // For PDFs, we can only extract metadata from the page that links to it
    const title = this.extractTitle($) || url.split('/').pop()?.replace('.pdf', '') || 'PDF Document'
    const description = this.extractDescription($) || 'PDF document'
    
    return {
      title: this.cleanText(title),
      description: this.cleanText(description),
      content: this.cleanText(description),
      wordCount: this.countWords(description)
    }
  }

  private extractImageContent($: cheerio.CheerioAPI, url: string): Omit<ScrapedContent, 'url' | 'contentType'> {
    const title = this.extractTitle($) || url.split('/').pop() || 'Image'
    const description = this.extractDescription($) || 'Image content'
    
    return {
      title: this.cleanText(title),
      description: this.cleanText(description),
      content: this.cleanText(description),
      wordCount: this.countWords(description)
    }
  }

  private extractGenericContent($: cheerio.CheerioAPI, url: string): Omit<ScrapedContent, 'url' | 'contentType'> {
    return {
      title: this.cleanText(this.extractTitle($)),
      description: this.cleanText(this.extractDescription($)),
      content: this.cleanText(this.extractMainContent($), this.options.maxContentLength),
      siteName: this.extractSiteName($),
      language: this.extractLanguage($),
      wordCount: this.countWords(this.extractMainContent($))
    }
  }

  private extractTitle($: cheerio.CheerioAPI): string {
    // Try multiple strategies for title extraction
    return $('meta[property="og:title"]').attr('content') ||
           $('meta[name="twitter:title"]').attr('content') ||
           $('title').text() ||
           $('h1').first().text() ||
           $('h2').first().text() ||
           'Untitled'
  }

  private extractDescription($: cheerio.CheerioAPI): string {
    return $('meta[property="og:description"]').attr('content') ||
           $('meta[name="twitter:description"]').attr('content') ||
           $('meta[name="description"]').attr('content') ||
           $('meta[property="description"]').attr('content') ||
           'No description available'
  }

  private extractMainContent($: cheerio.CheerioAPI): string {
    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .sidebar, .navigation, .menu, .ads, .advertisement').remove()
    
    // Attempting to extract main content
    
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
      // Add some common blog/article selectors
      '.article',
      '.blog-post',
      '.tutorial-content',
      '[role="main"]',
      '.page-content'
    ]
    
    for (const selector of contentSelectors) {
      const element = $(selector).first()
      if (element.length > 0) {
        const text = element.text().trim()
        if (text.length > 200) { // Only use if substantial content
          return text
        }
      }
    }
    
    // Fallback: extract from body, removing common non-content elements
    // Using fallback: extracting from body
    const bodyClone = $('body').clone()
    bodyClone.find('script, style, nav, header, footer, aside, .sidebar, .navigation, .menu, .ads, .advertisement, .comments, .social-share').remove()
    const bodyText = bodyClone.text().trim()
    return bodyText
  }

  private extractAuthor($: cheerio.CheerioAPI): string | undefined {
    const author = $('meta[name="author"]').attr('content') ||
                  $('meta[property="article:author"]').attr('content') ||
                  $('.author').first().text() ||
                  $('.byline').first().text() ||
                  $('[rel="author"]').first().text()
    
    return author ? author.trim() : undefined
  }

  private extractPublishDate($: cheerio.CheerioAPI): string | undefined {
    const dateStr = $('meta[property="article:published_time"]').attr('content') ||
                   $('meta[name="publishdate"]').attr('content') ||
                   $('time[datetime]').first().attr('datetime') ||
                   $('.date').first().text() ||
                   $('.published').first().text()
    
    if (!dateStr) return undefined
    
    try {
      const date = new Date(dateStr)
      return isNaN(date.getTime()) ? undefined : date.toISOString()
    } catch {
      return undefined
    }
  }

  private extractSiteName($: cheerio.CheerioAPI): string | undefined {
    return $('meta[property="og:site_name"]').attr('content') ||
           $('meta[name="application-name"]').attr('content')
  }

  private extractLanguage($: cheerio.CheerioAPI): string | undefined {
    return $('html').attr('lang') ||
           $('meta[http-equiv="content-language"]').attr('content')
  }

  private extractTags($: cheerio.CheerioAPI): string[] | undefined {
    const keywords = $('meta[name="keywords"]').attr('content')
    if (keywords) {
      return keywords.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
    }
    
    // Try to extract from article tags or categories
    const tags: string[] = []
    $('.tag, .category, .label').each((_, element) => {
      const tagText = $(element).text().trim()
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