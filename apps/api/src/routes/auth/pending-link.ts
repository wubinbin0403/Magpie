import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/index.js'
import { links } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { sendSuccess, sendError, notFound } from '../../utils/response.js'
import { idParamSchema } from '../../utils/validation.js'
import { requireApiToken, logOperation } from '../../middleware/auth.js'
import type { PendingLinkResponse } from '../../types/api.js'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

// Create pending link router with optional database dependency injection
function createPendingLinkRouter(database = db) {
  const app = new Hono()

// Error handling middleware
app.onError((err, c) => {
  console.error('Pending Link API Error:', err)
  
  if (err.message.includes('ZodError') || err.name === 'ZodError') {
    return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
  }
  
  return sendError(c, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred', undefined, 500)
})

// GET /api/links/:id/pending - Get pending link details (authenticated)
app.get('/:id/pending', requireApiToken(database), zValidator('param', idParamSchema), async (c) => {
  const startTime = Date.now()
  
  try {
    const { id } = c.req.valid('param')
    const tokenData = c.get('tokenData')
    const clientIp = c.get('clientIp')

    // Get link details - only allow access to pending links
    const linkResult = await database
      .select({
        id: links.id,
        url: links.url,
        title: links.title,
        originalDescription: links.originalDescription,
        aiSummary: links.aiSummary,
        aiCategory: links.aiCategory,
        aiTags: links.aiTags,
        userDescription: links.userDescription,
        userCategory: links.userCategory,
        userTags: links.userTags,
        domain: links.domain,
        status: links.status,
        createdAt: links.createdAt,
      })
      .from(links)
      .where(eq(links.id, id))
      .limit(1)

    if (linkResult.length === 0) {
      await logOperation(
        'link_view',
        'links',
        id,
        { reason: 'not_found' },
        tokenData?.id,
        undefined,
        clientIp,
        c.req.header('user-agent'),
        'failed',
        'Link not found'
      )
      
      return notFound(c, 'Link not found')
    }

    const link = linkResult[0]

    // Only allow access to pending links
    if (link.status !== 'pending') {
      await logOperation(
        'link_view',
        'links',
        id,
        { reason: 'invalid_status', status: link.status },
        tokenData?.id,
        undefined,
        clientIp,
        c.req.header('user-agent'),
        'failed',
        'Link is not in pending status'
      )
      
      return sendError(c, 'INVALID_STATUS', 'Link is not in pending status', undefined, 400)
    }

    // Format response
    const responseData: PendingLinkResponse = {
      id: link.id,
      url: link.url,
      title: link.title || '',
      originalDescription: link.originalDescription || '',
      aiSummary: link.aiSummary || '',
      aiCategory: link.aiCategory || '',
      aiTags: link.aiTags ? JSON.parse(link.aiTags) : [],
      domain: link.domain,
      createdAt: new Date(link.createdAt * 1000).toISOString(),
    }
    
    // User editable fields - only include if they have values
    if (link.userDescription) {
      responseData.userDescription = link.userDescription
    }
    if (link.userCategory) {
      responseData.userCategory = link.userCategory
    }
    if (link.userTags) {
      responseData.userTags = JSON.parse(link.userTags)
    }

    const duration = Date.now() - startTime

    // Log successful operation
    await logOperation(
      'link_view',
      'links',
      id,
      { type: 'pending', url: link.url },
      tokenData?.id,
      undefined,
      clientIp,
      c.req.header('user-agent'),
      'success',
      undefined,
      duration
    )

    return sendSuccess(c, responseData)

  } catch (error) {
    const duration = Date.now() - startTime
    const tokenData = c.get('tokenData')
    const clientIp = c.get('clientIp')
    
    await logOperation(
      'link_view',
      'links',
      undefined,
      { error: String(error) },
      tokenData?.id,
      undefined,
      clientIp,
      c.req.header('user-agent'),
      'failed',
      String(error),
      duration
    )
    
    console.error('Error fetching pending link:', error)
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to fetch pending link', undefined, 500)
  }
})

  return app
}

// Export both the router factory and a default instance
export { createPendingLinkRouter }
export default createPendingLinkRouter()