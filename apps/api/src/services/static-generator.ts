import { db } from '../db/index.js'
import { links, settings } from '../db/schema.js'
import { eq, and, or, desc, isNotNull } from 'drizzle-orm'
import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { logTaskExecution, systemLogger, taskLogger } from '../utils/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const STATIC_DIR = join(__dirname, '../../static')

// Site configuration interface
interface SiteConfig {
  title: string
  description: string
  baseUrl: string
}

// Ensure static directory exists
async function ensureStaticDir() {
  try {
    await fs.access(STATIC_DIR)
  } catch {
    await fs.mkdir(STATIC_DIR, { recursive: true })
  }
}

// Get site configuration from settings
async function getSiteConfig(database: any = db): Promise<SiteConfig> {
  try {
    const siteSettings = await database
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(or(
        eq(settings.key, 'site.title'),
        eq(settings.key, 'site.description')
      ))

    const configMap = new Map()
    siteSettings.forEach((setting: any) => {
      configMap.set(setting.key, setting.value)
    })

    return {
      title: configMap.get('site.title') || 'Magpie',
      description: configMap.get('site.description') || 'A lightweight link collection and display system',
      baseUrl: process.env.NODE_ENV === 'test' ? 'http://localhost:3001' : (process.env.BASE_URL || 'http://localhost:3001')
    }
  } catch (error) {
    // Only log error in non-test environments to avoid noise during testing
    if (process.env.NODE_ENV !== 'test') {
      systemLogger.error('Failed to get site configuration', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
    }
    return {
      title: 'Magpie',
      description: 'A lightweight link collection and display system',
      baseUrl: process.env.NODE_ENV === 'test' ? 'http://localhost:3001' : (process.env.BASE_URL || 'http://localhost:3001')
    }
  }
}

// Get published links for sitemap and RSS
async function getPublishedLinks(database: any = db) {
  return database
    .select({
      id: links.id,
      url: links.url,
      title: links.title,
      finalDescription: links.userDescription,
      finalCategory: links.userCategory,
      finalTags: links.userTags,
      publishedAt: links.publishedAt,
      clickCount: links.clickCount,
    })
    .from(links)
    .where(and(
      eq(links.status, 'published'),
      isNotNull(links.publishedAt)
    ))
    .orderBy(desc(links.publishedAt))
}

// Generate sitemap.xml
async function generateSitemap(database: any = db) {
  const siteConfig = await getSiteConfig(database)
  const publishedLinks = await getPublishedLinks(database)

  const now = new Date().toISOString()
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteConfig.baseUrl}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`

  publishedLinks.forEach((link: any) => {
    const publishedDate = link.publishedAt ? new Date(link.publishedAt * 1000).toISOString() : new Date().toISOString()
    xml += `
  <url>
    <loc>${siteConfig.baseUrl}/link/${link.id}</loc>
    <lastmod>${publishedDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
  })

  xml += '\n</urlset>'

  await ensureStaticDir()
  await fs.writeFile(join(STATIC_DIR, 'sitemap.xml'), xml, 'utf8')
  
  taskLogger.info('Generated sitemap.xml', {
    linkCount: publishedLinks.length
  })
}

// Generate RSS feed
async function generateRSSFeed(database: any = db) {
  const siteConfig = await getSiteConfig(database)
  const publishedLinks = await getPublishedLinks(database)

  // Limit RSS to recent 50 items
  const recentLinks = publishedLinks.slice(0, 50)

  const now = new Date().toUTCString()
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteConfig.title}</title>
    <link>${siteConfig.baseUrl}</link>
    <description>${siteConfig.description}</description>
    <language>zh-CN</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${siteConfig.baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <generator>Magpie Static Generator</generator>`

  recentLinks.forEach((link: any) => {
    const publishedDate = link.publishedAt ? new Date(link.publishedAt * 1000).toUTCString() : new Date().toUTCString()
    const tags = link.finalTags ? JSON.parse(link.finalTags) : []
    
    // Escape XML special characters
    const escapeXml = (text: string) => text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

    const title = escapeXml(link.title || 'Untitled')
    const description = escapeXml(link.finalDescription || '')
    const category = link.finalCategory || 'General'

    xml += `
    <item>
      <title>${title}</title>
      <link>${link.url}</link>
      <description>${description}</description>
      <category>${escapeXml(category)}</category>
      <pubDate>${publishedDate}</pubDate>
      <guid isPermaLink="true">${siteConfig.baseUrl}/link/${link.id}</guid>`

    // Add tags as categories
    tags.forEach((tag: string) => {
      xml += `
      <category>${escapeXml(tag)}</category>`
    })

    xml += `
    </item>`
  })

  xml += '\n  </channel>\n</rss>'

  await ensureStaticDir()
  await fs.writeFile(join(STATIC_DIR, 'feed.xml'), xml, 'utf8')
  
  taskLogger.info('Generated RSS feed', {
    itemCount: recentLinks.length
  })
}

// Generate JSON feed
async function generateJSONFeed(database: any = db) {
  const siteConfig = await getSiteConfig(database)
  const publishedLinks = await getPublishedLinks(database)

  // Limit JSON feed to recent 50 items
  const recentLinks = publishedLinks.slice(0, 50)

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: siteConfig.title,
    home_page_url: siteConfig.baseUrl,
    feed_url: `${siteConfig.baseUrl}/feed.json`,
    description: siteConfig.description,
    language: 'zh-CN',
    items: recentLinks.map((link: any) => {
      const tags = link.finalTags ? JSON.parse(link.finalTags) : []
      
      return {
        id: `${siteConfig.baseUrl}/link/${link.id}`,
        url: link.url,
        title: link.title || 'Untitled',
        summary: link.finalDescription || '',
        date_published: link.publishedAt ? new Date(link.publishedAt * 1000).toISOString() : new Date().toISOString(),
        tags: tags,
        category: link.finalCategory
      }
    })
  }

  await ensureStaticDir()
  await fs.writeFile(join(STATIC_DIR, 'feed.json'), JSON.stringify(feed, null, 2), 'utf8')
  
  taskLogger.info('Generated JSON feed', {
    itemCount: recentLinks.length
  })
}

// Generate all static files
export async function generateAllStaticFiles(database: any = db) {
  const startTime = Date.now()
  logTaskExecution('static-file-generation', 'start')
  try {
    await Promise.all([
      generateSitemap(database),
      generateRSSFeed(database),
      generateJSONFeed(database)
    ])
    
    logTaskExecution('static-file-generation', 'success', Date.now() - startTime)
  } catch (error) {
    logTaskExecution('static-file-generation', 'error', Date.now() - startTime, {
      error: error instanceof Error ? error.message : error
    })
    taskLogger.error('Static file generation failed', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }
}

// Background task wrapper for async generation
export function triggerStaticGeneration(database: any = db) {
  // In test environment, run synchronously to avoid database connection issues
  if (process.env.NODE_ENV === 'test') {
    taskLogger.debug('Static file generation triggered synchronously in test mode')
    return
  }

  // Run in background without blocking the main request
  setImmediate(() => {
    generateAllStaticFiles(database).catch(error => {
      // Only log error in non-test environments to avoid noise
      if (process.env.NODE_ENV !== 'test') {
        taskLogger.error('Background static file generation failed', {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined
        })
      }
    })
  })
  
  taskLogger.info('Static file generation triggered in background')
}

// Export individual generators for testing
export { generateSitemap, generateRSSFeed, generateJSONFeed, STATIC_DIR }
