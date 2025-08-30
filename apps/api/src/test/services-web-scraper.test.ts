import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WebScraper, createWebScraper, type ScrapedContent } from '../services/web-scraper.js'

// Mock fetch for testing
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('WebScraper Service', () => {
  let scraper: WebScraper

  beforeEach(() => {
    scraper = new WebScraper({
      timeout: 5000,
      maxContentLength: 2000
    })
    mockFetch.mockClear()
  })

  describe('Article Content Extraction', () => {
    it('should extract article content with full metadata', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <title>Test Article Title</title>
            <meta name="description" content="Test article description" />
            <meta property="og:title" content="OG Test Title" />
            <meta property="og:description" content="OG test description" />
            <meta property="og:site_name" content="Test Site" />
            <meta name="author" content="John Doe" />
            <meta property="article:published_time" content="2023-10-15T10:00:00Z" />
            <meta name="keywords" content="test, article, content" />
          </head>
          <body>
            <nav>Navigation</nav>
            <article>
              <h1>Article Title</h1>
              <p>This is the main content of the article. It contains multiple paragraphs and should be extracted properly.</p>
              <p>Second paragraph with more detailed content that explains the topic thoroughly.</p>
            </article>
            <footer>Footer</footer>
            <script>console.log('ads')</script>
          </body>
        </html>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml
      })

      const result = await scraper.scrape('https://example.com/article')

      expect(result).toEqual({
        url: 'https://example.com/article',
        contentType: 'article',
        title: 'OG Test Title',
        description: 'OG test description',
        content: expect.stringContaining('This is the main content of the article'),
        author: 'John Doe',
        publishDate: '2023-10-15T10:00:00.000Z',
        siteName: 'Test Site',
        language: 'en',
        tags: ['test', 'article', 'content'],
        wordCount: expect.any(Number)
      })

      expect(result.content).not.toContain('Navigation')
      expect(result.content).not.toContain('Footer')
      expect(result.content).not.toContain('<script>')
      expect(result.wordCount).toBeGreaterThan(0)
    })

    it('should use fallback selectors for content extraction', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Fallback Test</title>
            <meta name="description" content="Fallback description" />
          </head>
          <body>
            <header>Header</header>
            <main>
              <div class="post-content">
                <h1>Main Content Title</h1>
                <p>This content should be extracted using fallback selectors when article tag is not present.</p>
                <p>Additional content paragraph for testing word count and content extraction accuracy.</p>
              </div>
            </main>
            <aside class="sidebar">Sidebar content</aside>
          </body>
        </html>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml
      })

      const result = await scraper.scrape('https://example.com/fallback')

      expect(result.title).toBe('Fallback Test')
      expect(result.description).toBe('Fallback description')
      expect(result.content).toContain('This content should be extracted using fallback selectors')
      expect(result.content).not.toContain('Header')
      expect(result.content).not.toContain('Sidebar content')
    })

    it('should handle missing metadata gracefully', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Minimal Article</title>
          </head>
          <body>
            <div class="content">
              <p>Minimal content without much metadata.</p>
            </div>
          </body>
        </html>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml
      })

      const result = await scraper.scrape('https://example.com/minimal')

      expect(result.title).toBe('Minimal Article')
      expect(result.description).toBe('No description available')
      expect(result.author).toBeUndefined()
      expect(result.publishDate).toBeUndefined()
      expect(result.siteName).toBeUndefined()
      expect(result.language).toBeUndefined()
      expect(result.tags).toBeUndefined()
    })
  })

  describe('Video Content Extraction', () => {
    it('should detect and extract YouTube video metadata', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>YouTube Video Title</title>
            <meta name="description" content="Video description" />
            <meta property="og:site_name" content="YouTube" />
          </head>
          <body>
            <div id="meta-contents">
              <div id="description-text">Detailed video description with timestamps and links.</div>
            </div>
          </body>
        </html>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml
      })

      const result = await scraper.scrape('https://youtube.com/watch?v=123')

      expect(result.contentType).toBe('video')
      expect(result.title).toBe('YouTube Video Title')
      expect(result.content).toContain('Detailed video description')
      expect(result.siteName).toBe('YouTube')
    })

    it('should detect Bilibili videos', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Bilibili Video</title>
            <meta name="description" content="Bilibili description" />
          </head>
          <body>
            <div class="video-desc">
              <div class="intro">Video introduction text</div>
            </div>
          </body>
        </html>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml
      })

      const result = await scraper.scrape('https://bilibili.com/video/BV123456')

      expect(result.contentType).toBe('video')
      expect(result.content).toContain('Video introduction text')
    })
  })

  describe('PDF and Image Content Extraction', () => {
    it('should handle PDF files', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>PDF Document Title</title>
            <meta name="description" content="PDF description" />
          </head>
          <body>
            <h1>PDF Viewer</h1>
          </body>
        </html>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml
      })

      const result = await scraper.scrape('https://example.com/document.pdf')

      expect(result.contentType).toBe('pdf')
      expect(result.title).toBe('PDF Document Title')
      expect(result.description).toBe('PDF description')
    })

    it('should handle image files', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Image Gallery</title>
          </head>
          <body>
            <img src="image.jpg" alt="Test image" />
          </body>
        </html>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml
      })

      const result = await scraper.scrape('https://example.com/photo.jpg')

      expect(result.contentType).toBe('image')
      expect(result.title).toBe('Image Gallery')
    })
  })

  describe('Error Handling', () => {
    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      })

      await expect(scraper.scrape('https://example.com/notfound'))
        .rejects
        .toThrow('Failed to scrape content from https://example.com/notfound: HTTP 404: Not Found')
    })

    it('should handle network timeouts', async () => {
      mockFetch.mockRejectedValueOnce(new Error('timeout'))

      await expect(scraper.scrape('https://example.com/timeout'))
        .rejects
        .toThrow('Failed to scrape content from https://example.com/timeout: timeout')
    })

    it('should handle invalid URLs', async () => {
      await expect(scraper.scrape('invalid-url'))
        .rejects
        .toThrow('Failed to scrape content from invalid-url')
    })
  })

  describe('Content Processing', () => {
    it('should clean and truncate long content', async () => {
      const longContent = 'A'.repeat(3000)
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Long Content</title></head>
          <body>
            <article>
              <p>${longContent}</p>
            </article>
          </body>
        </html>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml
      })

      const result = await scraper.scrape('https://example.com/long')

      expect(result.content.length).toBeLessThanOrEqual(2003) // maxContentLength + '...'
      expect(result.content).toMatch(/A+\.\.\.$/)
    })

    it('should count words correctly including Chinese characters', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Multi-language Content</title></head>
          <body>
            <article>
              <p>Hello world 你好世界 test content 测试内容</p>
            </article>
          </body>
        </html>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml
      })

      const result = await scraper.scrape('https://example.com/multilang')

      expect(result.wordCount).toBeGreaterThan(0)
    })
  })

  describe('Factory Function', () => {
    it('should create scraper with custom options', () => {
      const customScraper = createWebScraper({
        timeout: 15000,
        maxContentLength: 5000,
        userAgent: 'Custom Bot'
      })

      expect(customScraper).toBeInstanceOf(WebScraper)
    })
  })

  describe('Content Type Detection', () => {
    it('should correctly identify different content types', async () => {
      const testCases = [
        { url: 'https://youtube.com/watch?v=abc', type: 'video' },
        { url: 'https://youtu.be/abc', type: 'video' },
        { url: 'https://vimeo.com/123', type: 'video' },
        { url: 'https://bilibili.com/video/BV123', type: 'video' },
        { url: 'https://example.com/doc.pdf', type: 'pdf' },
        { url: 'https://example.com/image.jpg', type: 'image' },
        { url: 'https://example.com/photo.png', type: 'image' },
        { url: 'https://example.com/article', type: 'article' }
      ]

      for (const testCase of testCases) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<html><head><title>Test</title></head><body><p>Content</p></body></html>'
        })

        const result = await scraper.scrape(testCase.url)
        expect(result.contentType).toBe(testCase.type)
      }
    })
  })
})