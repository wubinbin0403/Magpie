import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/index.js'
import { links } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { sendSuccess, sendError, notFound } from '../../utils/response.js'
import { idParamSchema } from '../../utils/validation.js'
import { requireApiToken, logOperation } from '../../middleware/auth.js'
import { triggerStaticGeneration } from '../../services/static-generator.js'
import { getUnifiedAuthData } from '../../types/hono-context.js'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

// Create delete link router with optional database dependency injection
function createDeleteLinkRouter(database = db) {
  const app = new Hono()

  // Error handling middleware
  app.onError((err, c) => {
    console.error('Delete Link API Error:', err)
    
    if (err.message.includes('ZodError') || err.name === 'ZodError') {
      return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
    }
    
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred', undefined, 500)
  })

  // DELETE /api/links/:id - Delete link (authenticated)
  app.delete('/:id', requireApiToken(database), zValidator('param', idParamSchema), async (c) => {
    const startTime = Date.now()
    
    try {
      const { id } = c.req.valid('param')
      const authData = getUnifiedAuthData(c)

      // Get link details first
      const linkResult = await database
        .select({
          id: links.id,
          url: links.url,
          title: links.title,
          status: links.status,
        })
        .from(links)
        .where(eq(links.id, id))
        .limit(1)

      if (linkResult.length === 0) {
        await logOperation(
          'link_delete',
          'links',
          id,
          { reason: 'not_found' },
          authData?.tokenId,
          authData?.userId,
          authData?.clientIp || 'unknown',
          authData?.userAgent,
          'failed',
          'Link not found'
        )
        
        return notFound(c, 'Link not found')
      }

      const link = linkResult[0]

      // Check if already deleted
      if (link.status === 'deleted') {
        await logOperation(
          'link_delete',
          'links',
          id,
          { reason: 'already_deleted', url: link.url },
          authData?.tokenId,
          authData?.userId,
          authData?.clientIp || 'unknown',
          authData?.userAgent,
          'failed',
          'Link is already deleted'
        )
        
        return sendError(c, 'ALREADY_DELETED', 'Link is already deleted', undefined, 400)
      }

      const now = Math.floor(Date.now() / 1000)

      // Soft delete - mark as deleted instead of hard delete
      await database
        .update(links)
        .set({
          status: 'deleted',
          updatedAt: now
        })
        .where(eq(links.id, id))

      const duration = Date.now() - startTime

      // Log successful operation
      await logOperation(
        'link_delete',
        'links',
        id,
        { 
          url: link.url,
          title: link.title,
          previous_status: link.status
        },
        authData?.tokenId,
        authData?.userId,
        authData?.clientIp || 'unknown',
        authData?.userAgent,
        'success',
        undefined,
        duration
      )

      // Trigger static file generation in background (for published links that were deleted)
      if (link.status === 'published') {
        triggerStaticGeneration(database)
      }

      return sendSuccess(c, {}, 'Link deleted successfully')

    } catch (error) {
      const duration = Date.now() - startTime
      const authData = getUnifiedAuthData(c)
      
      await logOperation(
        'link_delete',
        'links',
        undefined,
        { error: String(error) },
        authData?.tokenId,
        authData?.userId,
        authData?.clientIp || 'unknown',
        authData?.userAgent,
        'failed',
        String(error),
        duration
      )
      
      console.error('Error deleting link:', error)
      return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to delete link', undefined, 500)
    }
  })

  return app
}

// Export both the router factory and a default instance
export { createDeleteLinkRouter }
export default createDeleteLinkRouter()