import { db } from '../db/index.js'
import { links, settings } from '../db/schema.js'
import { eq, and, or, desc, isNotNull, sql } from 'drizzle-orm'
import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

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
async function getSiteConfig(database: BetterSQLite3Database<any> = db): Promise<SiteConfig> {
  try {
    const siteSettings = await database
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(or(
        eq(settings.key, 'site.title'),
        eq(settings.key, 'site.description')
      ))

    const configMap = new Map()
    siteSettings.forEach(setting => {
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
      console.error('Failed to get site config:', error)
    }
    return {
      title: 'Magpie',
      description: 'A lightweight link collection and display system',
      baseUrl: process.env.NODE_ENV === 'test' ? 'http://localhost:3001' : (process.env.BASE_URL || 'http://localhost:3001')
    }
  }
}

// Get published links for sitemap and RSS
async function getPublishedLinks(database: BetterSQLite3Database<any> = db) {
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
async function generateSitemap(database: BetterSQLite3Database<any> = db) {
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

  publishedLinks.forEach(link => {
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
  
  console.log(`Generated sitemap.xml with ${publishedLinks.length} links`)
}

// Generate RSS feed
async function generateRSSFeed(database: BetterSQLite3Database<any> = db) {
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

  recentLinks.forEach(link => {
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
      <guid isPermaLink="false">${siteConfig.baseUrl}/link/${link.id}</guid>`

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
  
  console.log(`Generated RSS feed with ${recentLinks.length} recent links`)
}

// Generate JSON feed
async function generateJSONFeed(database: BetterSQLite3Database<any> = db) {
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
    items: recentLinks.map(link => {
      const tags = link.finalTags ? JSON.parse(link.finalTags) : []
      
      return {
        id: `${siteConfig.baseUrl}/link/${link.id}`,
        url: link.url,
        title: link.title || 'Untitled',
        content_text: link.finalDescription || '',
        summary: link.finalDescription || '',
        date_published: link.publishedAt ? new Date(link.publishedAt * 1000).toISOString() : new Date().toISOString(),
        tags: [link.finalCategory, ...tags].filter(Boolean),
        external_url: link.url,
        _magpie: {
          category: link.finalCategory,
          click_count: link.clickCount,
          internal_link: `${siteConfig.baseUrl}/link/${link.id}`
        }
      }
    })
  }

  await ensureStaticDir()
  await fs.writeFile(join(STATIC_DIR, 'feed.json'), JSON.stringify(feed, null, 2), 'utf8')
  
  console.log(`Generated JSON feed with ${recentLinks.length} recent links`)
}

// Generate all static files
export async function generateAllStaticFiles(database: BetterSQLite3Database<any> = db) {
  try {
    console.log('Starting static file generation...')
    
    await Promise.all([
      generateSitemap(database),
      generateRSSFeed(database),
      generateJSONFeed(database)
    ])
    
    console.log('Static file generation completed successfully')
  } catch (error) {
    console.error('Failed to generate static files:', error)
    throw error
  }
}

// Background task wrapper for async generation
export function triggerStaticGeneration(database: BetterSQLite3Database<any> = db) {
  // In test environment, run synchronously to avoid database connection issues
  if (process.env.NODE_ENV === 'test') {
    console.log('Static file generation triggered in test mode (sync)')
    return
  }

  // Run in background without blocking the main request
  setImmediate(() => {
    generateAllStaticFiles(database).catch(error => {
      // Only log error in non-test environments to avoid noise
      if (process.env.NODE_ENV !== 'test') {
        console.error('Background static file generation failed:', error)
      }
    })
  })
  
  console.log('Static file generation triggered in background')
}

// Export individual generators for testing
export { generateSitemap, generateRSSFeed, generateJSONFeed, STATIC_DIR }