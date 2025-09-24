import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { links } from '../../db/schema.js'
import { eq, sql, and } from 'drizzle-orm'
import { sendSuccess, sendError } from '../../utils/response.js'
import { apiLogger } from '../../utils/logger.js'

// Validation schema for domain query
const domainQuerySchema = z.object({
  domain: z.string().min(1),
})

// Create domains router with optional database dependency injection
function createDomainsRouter(database = db) {
  const app = new Hono()

  // Error handling middleware
  app.onError((err, c) => {
    apiLogger.error('Domains API error', {
      error: err instanceof Error ? err.message : err,
      stack: err instanceof Error ? err.stack : undefined
    })
    
    if (err instanceof Error && (err.message.includes('ZodError') || err.name === 'ZodError')) {
      return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
    }
    
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred', undefined, 500)
  })

  // GET /api/domains/:domain/stats - 获取单个域名的统计信息
  app.get('/:domain/stats', zValidator('param', domainQuerySchema), async (c) => {
    let requestedDomain: string | undefined

    try {
      const params = c.req.valid('param')
      requestedDomain = params.domain
      const { domain } = params
      
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
      apiLogger.error('Error fetching domain stats', {
        domain: requestedDomain ?? c.req.param('domain'),
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
      return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to fetch domain statistics', undefined, 500)
    }
  })

  return app
}

// Export both the router factory and a default instance
export { createDomainsRouter }
export default createDomainsRouter()
