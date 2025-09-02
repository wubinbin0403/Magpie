import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { settings, links } from '../db/schema.js'
import { generateAllStaticFiles, generateSitemap, generateRSSFeed, generateJSONFeed, STATIC_DIR } from '../services/static-generator.js'

describe('Static File Generator Service', () => {
  beforeEach(async () => {
    clearTestData()

    const now = Math.floor(Date.now() / 1000)

    // Set up site configuration
    await testDrizzle.insert(settings).values([
      {
        key: 'site.title',
        value: 'Test Magpie Site',
        type: 'string',
        description: 'Site title',
        createdAt: now,
        updatedAt: now,
      },
      {
        key: 'site.description',
        value: 'A test site for link collection',
        type: 'string',
        description: 'Site description',
        createdAt: now,
        updatedAt: now,
      }
    ])

    // Add some test published links
    await testDrizzle.insert(links).values([
      {
        id: 1,
        url: 'https://example.com/article1',
        domain: 'example.com',
        title: 'Test Article 1',
        userDescription: 'This is a test article about technology',
        userCategory: '技术',
        userTags: JSON.stringify(['tech', 'test']),
        status: 'published',
        createdAt: now - 3600,
        publishedAt: now - 3600,
        searchText: 'test article technology tech',
        clickCount: 5,
      },
      {
        id: 2,
        url: 'https://example.com/article2',
        domain: 'example.com',
        title: 'Test Article 2',
        userDescription: 'Another test article about design',
        userCategory: '设计',
        userTags: JSON.stringify(['design', 'ui']),
        status: 'published',
        createdAt: now - 1800,
        publishedAt: now - 1800,
        searchText: 'test article design ui',
        clickCount: 3,
      },
      {
        id: 3,
        url: 'https://example.com/draft',
        domain: 'example.com',
        title: 'Draft Article',
        userDescription: 'This is a draft',
        userCategory: '其他',
        status: 'pending',
        createdAt: now,
        searchText: 'draft article',
        clickCount: 0,
      }
    ])
  })

  afterEach(async () => {
    // Clean up generated static files
    try {
      await fs.rm(STATIC_DIR, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('generateSitemap', () => {
    it('should generate valid sitemap.xml', async () => {
      await generateSitemap(testDrizzle)
      
      const sitemapPath = join(STATIC_DIR, 'sitemap.xml')
      const content = await fs.readFile(sitemapPath, 'utf8')
      
      expect(content).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(content).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
      expect(content).toContain('http://localhost:3001') // base URL
      expect(content).toContain('/link/1')
      expect(content).toContain('/link/2')
      expect(content).not.toContain('/link/3') // Should not include pending links
      expect(content).toContain('</urlset>')
    })

    it('should include proper priority and changefreq', async () => {
      await generateSitemap(testDrizzle)
      
      const sitemapPath = join(STATIC_DIR, 'sitemap.xml')
      const content = await fs.readFile(sitemapPath, 'utf8')
      
      expect(content).toContain('<priority>1.0</priority>') // Home page
      expect(content).toContain('<priority>0.8</priority>') // Link pages
      expect(content).toContain('<changefreq>daily</changefreq>') // Home page
      expect(content).toContain('<changefreq>weekly</changefreq>') // Link pages
    })
  })

  describe('generateRSSFeed', () => {
    it('should generate valid RSS feed', async () => {
      await generateRSSFeed(testDrizzle)
      
      const feedPath = join(STATIC_DIR, 'feed.xml')
      const content = await fs.readFile(feedPath, 'utf8')
      
      expect(content).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(content).toContain('<rss version="2.0"')
      expect(content).toContain('<title>Test Magpie Site</title>')
      expect(content).toContain('<description>A test site for link collection</description>')
      expect(content).toContain('<language>zh-CN</language>')
      expect(content).toContain('Test Article 1')
      expect(content).toContain('Test Article 2')
      expect(content).not.toContain('Draft Article') // Should not include pending links
    })

    it('should include proper RSS item structure', async () => {
      await generateRSSFeed(testDrizzle)
      
      const feedPath = join(STATIC_DIR, 'feed.xml')
      const content = await fs.readFile(feedPath, 'utf8')
      
      expect(content).toContain('<item>')
      expect(content).toContain('<title>Test Article 1</title>')
      expect(content).toContain('<link>https://example.com/article1</link>')
      expect(content).toContain('<description>This is a test article about technology</description>')
      expect(content).toContain('<category>技术</category>')
      expect(content).toContain('<category>tech</category>')
      expect(content).toContain('<category>test</category>')
      expect(content).toContain('<pubDate>')
      expect(content).toContain('<guid')
      expect(content).toContain('</item>')
    })

    it('should escape XML special characters', async () => {
      // Add a link with special characters
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle.insert(links).values([
        {
          id: 4,
          url: 'https://example.com/special',
          domain: 'example.com',
          title: 'Article with <special> & "quoted" text',
          userDescription: 'Description with & < > " \' characters',
          userCategory: 'Test & Debug',
          userTags: JSON.stringify(['test&debug']),
          status: 'published',
          createdAt: now,
          publishedAt: now,
          searchText: 'special characters test',
          clickCount: 0,
        }
      ])

      await generateRSSFeed(testDrizzle)
      
      const feedPath = join(STATIC_DIR, 'feed.xml')
      const content = await fs.readFile(feedPath, 'utf8')
      
      expect(content).toContain('&lt;special&gt; &amp; &quot;quoted&quot;')
      expect(content).toContain('Description with &amp; &lt; &gt; &quot; &#39; characters')
      expect(content).toContain('Test &amp; Debug')
    })
  })

  describe('generateJSONFeed', () => {
    it('should generate valid JSON feed', async () => {
      await generateJSONFeed(testDrizzle)
      
      const feedPath = join(STATIC_DIR, 'feed.json')
      const content = await fs.readFile(feedPath, 'utf8')
      const feed = JSON.parse(content)
      
      expect(feed.version).toBe('https://jsonfeed.org/version/1.1')
      expect(feed.title).toBe('Test Magpie Site')
      expect(feed.description).toBe('A test site for link collection')
      expect(feed.home_page_url).toBe('http://localhost:3001')
      expect(feed.feed_url).toBe('http://localhost:3001/feed.json')
      expect(feed.language).toBe('zh-CN')
      expect(Array.isArray(feed.items)).toBe(true)
      expect(feed.items).toHaveLength(2) // Only published links
    })

    it('should include proper item structure', async () => {
      await generateJSONFeed(testDrizzle)
      
      const feedPath = join(STATIC_DIR, 'feed.json')
      const content = await fs.readFile(feedPath, 'utf8')
      const feed = JSON.parse(content)
      
      const firstItem = feed.items[0]
      expect(firstItem.id).toContain('/link/')
      expect(firstItem.url).toBe('https://example.com/article2') // Should be most recent first
      expect(firstItem.title).toBe('Test Article 2')
      expect(firstItem.content_text).toBe('Another test article about design')
      expect(firstItem.summary).toBe('Another test article about design')
      expect(firstItem.date_published).toBeDefined()
      expect(Array.isArray(firstItem.tags)).toBe(true)
      expect(firstItem.tags).toContain('设计')
      expect(firstItem.tags).toContain('design')
      expect(firstItem.tags).toContain('ui')
      expect(firstItem.external_url).toBe('https://example.com/article2')
      expect(firstItem._magpie).toBeDefined()
      expect(firstItem._magpie.category).toBe('设计')
      expect(firstItem._magpie.click_count).toBe(3)
    })
  })

  describe('generateAllStaticFiles', () => {
    it('should generate all static files', async () => {
      await generateAllStaticFiles(testDrizzle)
      
      // Check that all files exist
      const sitemapPath = join(STATIC_DIR, 'sitemap.xml')
      const rssFeedPath = join(STATIC_DIR, 'feed.xml')
      const jsonFeedPath = join(STATIC_DIR, 'feed.json')
      
      await expect(fs.access(sitemapPath)).resolves.toBeUndefined()
      await expect(fs.access(rssFeedPath)).resolves.toBeUndefined()
      await expect(fs.access(jsonFeedPath)).resolves.toBeUndefined()
      
      // Verify content is valid
      const sitemapContent = await fs.readFile(sitemapPath, 'utf8')
      const rssFeedContent = await fs.readFile(rssFeedPath, 'utf8')
      const jsonFeedContent = await fs.readFile(jsonFeedPath, 'utf8')
      
      expect(sitemapContent).toContain('<urlset')
      expect(rssFeedContent).toContain('<rss')
      expect(() => JSON.parse(jsonFeedContent)).not.toThrow()
    })
  })

  describe('error handling', () => {
    it('should handle missing site settings gracefully', async () => {
      // Clear site settings
      await testDrizzle.delete(settings)
      
      await expect(generateAllStaticFiles(testDrizzle)).resolves.toBeUndefined()
      
      // Check that files are generated with default values
      const rssFeedPath = join(STATIC_DIR, 'feed.xml')
      const content = await fs.readFile(rssFeedPath, 'utf8')
      expect(content).toContain('<title>Magpie</title>') // Default title
    })

    it('should handle no published links', async () => {
      // Mark all links as pending
      await testDrizzle.update(links).set({ status: 'pending' })
      
      await expect(generateAllStaticFiles(testDrizzle)).resolves.toBeUndefined()
      
      const sitemapPath = join(STATIC_DIR, 'sitemap.xml')
      const content = await fs.readFile(sitemapPath, 'utf8')
      
      // Should only contain home page
      expect(content).toContain('<urlset')
      expect(content).not.toContain('/link/')
      expect(content).toContain('</urlset>')
    })
  })
})