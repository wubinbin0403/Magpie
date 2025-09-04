import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/index.js'
import { links } from '../../db/schema.js'
import { eq, desc, asc, count, and, or, like, inArray } from 'drizzle-orm'
import { sendSuccess, sendError } from '../../utils/response.js'
import { adminLinksQuerySchema } from '../../utils/validation.js'
import { requireAdmin } from '../../middleware/admin.js'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

// Admin link type
interface AdminLink {
  id: number
  url: string
  title: string
  domain: string
  description: string
  category: string
  tags: string[]
  status: 'published' | 'pending' | 'deleted'
  createdAt: number
  publishedAt?: number
  readingTime?: number
}

// Create admin links router with optional database dependency injection
export function createAdminLinksRouter(database = db) {
  const app = new Hono()

  // Error handling middleware
  app.onError((err, c) => {
    console.error('Admin Links API Error:', err)
    
    if (err.message.includes('ZodError') || err.name === 'ZodError') {
      return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
    }
    
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred', undefined, 500)
  })

  // GET /api/admin/links - Get all links (published, pending, deleted) with filtering
  app.get('/', requireAdmin(database), zValidator('query', adminLinksQuerySchema), async (c) => {
    try {
      const { page, limit, search, status, sort, category, domain } = c.req.valid('query')
      
      const offset = (page - 1) * limit
      
      // Build query conditions
      let whereConditions: any[] = []
      
      // Status filter
      if (status !== 'all') {
        whereConditions.push(eq(links.status, status))
      }
      
      // Domain filter
      if (domain) {
        whereConditions.push(eq(links.domain, domain))
      }
      
      // Category filter
      if (category) {
        whereConditions.push(
          or(
            eq(links.aiCategory, category),
            eq(links.userCategory, category)
          )
        )
      }
      
      // Search filter (search in title, description, domain, category, and ID)
      if (search) {
        const searchTerm = `%${search}%`
        const idSearch = parseInt(search)
        
        const searchConditions = [
          like(links.title, searchTerm),
          like(links.originalDescription, searchTerm),
          like(links.userDescription, searchTerm),
          like(links.aiSummary, searchTerm),
          like(links.domain, searchTerm),
          like(links.aiCategory, searchTerm),
          like(links.userCategory, searchTerm)
        ]
        
        // If search is a number, also search by ID
        if (!isNaN(idSearch) && idSearch > 0) {
          searchConditions.push(eq(links.id, idSearch))
        }
        
        whereConditions.push(or(...searchConditions))
      }
      
      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined
      
      // Build sorting
      let orderBy: any
      switch (sort) {
        case 'oldest':
          orderBy = asc(links.createdAt)
          break
        case 'title':
          orderBy = asc(links.title)
          break
        case 'domain':
          orderBy = asc(links.domain)
          break
        default: // newest
          orderBy = desc(links.createdAt)
      }
      
      // Get total count
      let totalCountQuery = database
        .select({ count: count() })
        .from(links)
      
      if (whereClause) {
        totalCountQuery = totalCountQuery.where(whereClause)
      }
      
      const totalResult = await totalCountQuery
      
      const total = totalResult[0].count
      const totalPages = Math.ceil(total / limit)
      
      // Get links list
      let linksQuery = database
        .select({
          id: links.id,
          url: links.url,
          title: links.title,
          domain: links.domain,
          originalDescription: links.originalDescription,
          userDescription: links.userDescription,
          aiSummary: links.aiSummary,
          aiCategory: links.aiCategory,
          userCategory: links.userCategory,
          aiTags: links.aiTags,
          userTags: links.userTags,
          status: links.status,
          createdAt: links.createdAt,
          publishedAt: links.publishedAt,
          readingTime: links.aiReadingTime,
        })
        .from(links)
      
      if (whereClause) {
        linksQuery = linksQuery.where(whereClause)
      }
      
      const linksResult = await linksQuery.orderBy(orderBy).limit(limit).offset(offset)
      
      // Format response data
      const formattedLinks: AdminLink[] = linksResult.map(link => {
        // Use user data if available, otherwise fall back to AI data
        const description = link.userDescription || link.aiSummary || link.originalDescription || ''
        const category = link.userCategory || link.aiCategory || ''
        const tags = (() => {
          try {
            const userTags = link.userTags ? JSON.parse(link.userTags) : []
            const aiTags = link.aiTags ? JSON.parse(link.aiTags) : []
            return userTags.length > 0 ? userTags : aiTags
          } catch {
            return []
          }
        })()
        
        return {
          id: link.id,
          url: link.url,
          title: link.title || '',
          domain: link.domain,
          description,
          category,
          tags,
          status: link.status as 'published' | 'pending' | 'deleted',
          createdAt: link.createdAt,
          publishedAt: link.publishedAt || undefined,
          readingTime: link.readingTime || undefined,
        }
      })
      
      const pagination = {
        page,
        limit,
        total,
        totalPages
      }
      
      return sendSuccess(c, {
        links: formattedLinks,
        pagination
      })
      
    } catch (error) {
      console.error('Error fetching admin links:', error)
      return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to fetch links')
    }
  })

  return app
}

// Export the router instance for use in main app
const adminLinksRouter = createAdminLinksRouter()
export default adminLinksRouter