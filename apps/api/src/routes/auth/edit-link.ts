import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/index.js'
import { links } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { sendSuccess, sendError, notFound } from '../../utils/response.js'
import { idParamSchema, updateLinkSchema } from '../../utils/validation.js'
import { requireApiToken, logOperation } from '../../middleware/auth.js'
import { apiLogger } from '../../utils/logger.js'

// Create edit link router with optional database dependency injection
function createEditLinkRouter(database = db) {
  const app = new Hono()

  // Error handling middleware
  app.onError((err, c) => {
    apiLogger.error('Edit Link API error', {
      error: err instanceof Error ? err.message : err,
      stack: err instanceof Error ? err.stack : undefined
    })
    
    if (err.message.includes('ZodError') || err.name === 'ZodError') {
      return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
    }
    
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred', undefined, 500)
  })

  // PUT /api/links/:id - Update link (authenticated)
  app.put('/:id', 
    requireApiToken(database), 
    zValidator('param', idParamSchema),
    zValidator('json', updateLinkSchema), 
    async (c) => {
      const startTime = Date.now()
      
      try {
        const { id } = c.req.valid('param')
        const updateData = c.req.valid('json')
        const tokenData = (c as any).get('tokenData') as { id: number } | undefined
        const clientIp = (c as any).get('clientIp') as string

        // Get link details first
        const linkResult = await database
          .select()
          .from(links)
          .where(eq(links.id, id))
          .limit(1)

        if (linkResult.length === 0) {
          await logOperation(
            'link_update',
            'links',
            id,
            { reason: 'not_found', updates: updateData },
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

        // Check if already deleted
        if (link.status === 'deleted') {
          await logOperation(
            'link_update',
            'links',
            id,
            { reason: 'already_deleted', url: link.url, updates: updateData },
            tokenData?.id,
            undefined,
            clientIp,
            c.req.header('user-agent'),
            'failed',
            'Link is already deleted'
          )
          
          return sendError(c, 'ALREADY_DELETED', 'Link is already deleted', undefined, 400)
        }

        const now = Math.floor(Date.now() / 1000)
        const updateFields: any = {
          updatedAt: now
        }

        // Handle status change - special case for publishing
        if (updateData.status) {
          updateFields.status = updateData.status
          
          if (updateData.status === 'published') {
            updateFields.publishedAt = now
            
            // When publishing, set user values if provided
            if (updateData.description !== undefined) {
              updateFields.userDescription = updateData.description
            }
            if (updateData.category !== undefined) {
              updateFields.userCategory = updateData.category
            }
            if (updateData.tags !== undefined) {
              updateFields.userTags = JSON.stringify(updateData.tags)
            }
          }
        }

        // Update title if provided
        if (updateData.title !== undefined) {
          updateFields.title = updateData.title
        }

        // Handle field updates - always use user fields
        if (updateData.description !== undefined) {
          updateFields.userDescription = updateData.description
        }
        if (updateData.category !== undefined) {
          updateFields.userCategory = updateData.category
        }
        if (updateData.tags !== undefined) {
          updateFields.userTags = JSON.stringify(updateData.tags)
        }

        // Update the link
        await database
          .update(links)
          .set(updateFields)
          .where(eq(links.id, id))

        const duration = Date.now() - startTime

        // Log successful operation
        await logOperation(
          'link_update',
          'links',
          id,
          { 
            url: link.url,
            title: link.title,
            previous_status: link.status,
            new_status: updateData.status || link.status,
            updates: updateData
          },
          tokenData?.id,
          undefined,
          clientIp,
          c.req.header('user-agent'),
          'success',
          undefined,
          duration
        )

        return sendSuccess(c, {}, 'Link updated successfully')

      } catch (error) {
        const duration = Date.now() - startTime
        const tokenData = (c as any).get('tokenData') as { id: number } | undefined
        const clientIp = (c as any).get('clientIp') as string
        
        await logOperation(
          'link_update',
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
        
        apiLogger.error('Error updating link', {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined
        })
        return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to update link', undefined, 500)
      }
    }
  )

  return app
}

// Export both the router factory and a default instance
export { createEditLinkRouter }
export default createEditLinkRouter()
