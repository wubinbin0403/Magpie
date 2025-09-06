import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { links } from '../../db/schema.js'
import { eq, sql, and } from 'drizzle-orm'
import { sendSuccess, sendError } from '../../utils/response.js'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

// Validation schema for domain query
const domainQuerySchema = z.object({
  domain: z.string().min(1),
})

// Create domains router with optional database dependency injection
function createDomainsRouter(database = db) {
  const app = new Hono()

  // Error handling middleware
  app.onError((err, c) => {
    console.error('Domains API Error:', err)
    
    if (err.message.includes('ZodError') || err.name === 'ZodError') {
      return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
    }
    
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred', undefined, 500)
  })

  // GET /api/domains/:domain/stats - 获取单个域名的统计信息
  app.get('/:domain/stats', zValidator('param', domainQuerySchema), async (c) => {
    try {
      const { domain } = c.req.valid('param')
      
      // 获取该域名下的链接数量
      const countResult = await database
        .select({ count: sql<number>`count(*)` })
        .from(links)
        .where(and(
          eq(links.domain, domain),
          eq(links.status, 'published')
        ))
      
      const count = countResult[0]?.count || 0
      
      if (count === 0) {
        return sendError(c, 'NOT_FOUND', 'Domain not found or has no published links', undefined, 404)
      }

      // 获取该域名的最新链接（可选，提供更多信息）
      const latestLink = await database
        .select({ 
          publishedAt: links.publishedAt,
          title: links.title 
        })
        .from(links)
        .where(and(
          eq(links.domain, domain),
          eq(links.status, 'published')
        ))
        .orderBy(sql`${links.publishedAt} DESC`)
        .limit(1)

      const response = {
        domain,
        count,
        latestPublished: latestLink[0] && latestLink[0].publishedAt ? new Date(latestLink[0].publishedAt * 1000).toISOString() : null,
        latestTitle: latestLink[0]?.title || null
      }

      return sendSuccess(c, response)
      
    } catch (error) {
      console.error('Error fetching domain stats:', error)
      return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to fetch domain statistics', undefined, 500)
    }
  })

  return app
}

// Export both the router factory and a default instance
export { createDomainsRouter }
export default createDomainsRouter()