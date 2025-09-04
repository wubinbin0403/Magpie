import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/index.js'
import { links } from '../../db/schema.js'
import { eq, desc, asc, count, and, or, like, inArray } from 'drizzle-orm'
import { sendSuccess, sendError, notFound } from '../../utils/response.js'
import { adminLinksQuerySchema, idParamSchema, updateLinkSchema } from '../../utils/validation.js'
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
      const totalResult = whereClause 
        ? await database
            .select({ count: count() })
            .from(links)
            .where(whereClause)
        : await database
            .select({ count: count() })
            .from(links)
      
      const total = totalResult[0].count
      const totalPages = Math.ceil(total / limit)
      
      // Get links list
      const linksResult = whereClause 
        ? await database
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
            .where(whereClause)
            .orderBy(orderBy)
            .limit(limit)
            .offset(offset)
        : await database
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
            .orderBy(orderBy)
            .limit(limit)
            .offset(offset)
      
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

  // PUT /api/admin/links/:id - Update link (admin authenticated)
  app.put('/:id', 
    requireAdmin(database), 
    zValidator('param', idParamSchema),
    zValidator('json', updateLinkSchema),
    async (c) => {
      try {
        const { id } = c.req.valid('param')
        const updateData = c.req.valid('json')

        // Get link details first
        const linkResult = await database
          .select()
          .from(links)
          .where(eq(links.id, id))
          .limit(1)

        if (linkResult.length === 0) {
          return notFound(c, 'Link not found')
        }

        const link = linkResult[0]
        const now = Math.floor(Date.now() / 1000)
        const updateFields: any = {
          updatedAt: now
        }

        // Handle status change
        if (updateData.status) {
          updateFields.status = updateData.status
          
          if (updateData.status === 'published' && link.status !== 'published') {
            updateFields.publishedAt = now
          }
        }

        // Update title if provided
        if (updateData.title !== undefined) {
          updateFields.title = updateData.title
        }

        // Update user values if provided
        if (updateData.description !== undefined) {
          updateFields.userDescription = updateData.description
        }
        if (updateData.category !== undefined) {
          updateFields.userCategory = updateData.category
        }
        if (updateData.tags !== undefined) {
          updateFields.userTags = JSON.stringify(updateData.tags)
        }

        // Perform the update
        await database
          .update(links)
          .set(updateFields)
          .where(eq(links.id, id))

        // Fetch and return the updated link
        const updatedLinkResult = await database
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
          .where(eq(links.id, id))
          .limit(1)

        if (updatedLinkResult.length === 0) {
          return sendError(c, 'UPDATE_FAILED', 'Failed to fetch updated link')
        }

        const updatedLink = updatedLinkResult[0]
        
        // Format response data same as GET endpoint
        const description = updatedLink.userDescription || updatedLink.aiSummary || updatedLink.originalDescription || ''
        const category = updatedLink.userCategory || updatedLink.aiCategory || ''
        const tags = (() => {
          try {
            const userTags = updatedLink.userTags ? JSON.parse(updatedLink.userTags) : []
            const aiTags = updatedLink.aiTags ? JSON.parse(updatedLink.aiTags) : []
            return userTags.length > 0 ? userTags : aiTags
          } catch {
            return []
          }
        })()

        const formattedLink = {
          id: updatedLink.id,
          url: updatedLink.url,
          title: updatedLink.title || '',
          domain: updatedLink.domain,
          description,
          category,
          tags,
          status: updatedLink.status as 'published' | 'pending' | 'deleted',
          createdAt: updatedLink.createdAt,
          publishedAt: updatedLink.publishedAt || undefined,
          readingTime: updatedLink.readingTime || undefined,
        }

        return sendSuccess(c, formattedLink)
        
      } catch (error) {
        console.error('Error updating admin link:', error)
        return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to update link')
      }
    })

  return app
}

// Export the router instance for use in main app
const adminLinksRouter = createAdminLinksRouter()
export default adminLinksRouter