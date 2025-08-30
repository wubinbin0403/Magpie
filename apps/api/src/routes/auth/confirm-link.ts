import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/index.js'
import { links } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { sendSuccess, sendError, notFound } from '../../utils/response.js'
import { idParamSchema, confirmLinkSchema } from '../../utils/validation.js'
import { requireApiToken, logOperation } from '../../middleware/auth.js'
import { triggerStaticGeneration } from '../../services/static-generator.js'
import type { ConfirmLinkResponse } from '../../types/api.js'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

// Create confirm link router with optional database dependency injection
function createConfirmLinkRouter(database = db) {
  const app = new Hono()

  // Error handling middleware
  app.onError((err, c) => {
    console.error('Confirm Link API Error:', err)
    
    if (err.message.includes('ZodError') || err.name === 'ZodError') {
      return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
    }
    
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred', undefined, 500)
  })

  // POST /api/links/:id/confirm - Confirm and publish link (authenticated)
  app.post('/:id/confirm', requireApiToken(database), zValidator('param', idParamSchema), zValidator('json', confirmLinkSchema), async (c) => {
    const startTime = Date.now()
    
    try {
      const { id } = c.req.valid('param')
      const { title, description, category, tags, publish = true } = c.req.valid('json')
      const tokenData = c.get('tokenData')
      const clientIp = c.get('clientIp')

      // Get link details - only allow pending links
      const linkResult = await database
        .select({
          id: links.id,
          url: links.url,
          title: links.title,
          aiSummary: links.aiSummary,
          aiCategory: links.aiCategory,
          aiTags: links.aiTags,
          status: links.status,
        })
        .from(links)
        .where(eq(links.id, id))
        .limit(1)

      if (linkResult.length === 0) {
        await logOperation(
          'link_confirm',
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

      // Only allow confirming pending links
      if (link.status !== 'pending') {
        await logOperation(
          'link_confirm',
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

      const now = Math.floor(Date.now() / 1000)

      // Prepare update data
      const updateData: any = {
        // Update user-provided or AI-generated content
        userDescription: description,
        userCategory: category || link.aiCategory,
        userTags: tags ? JSON.stringify(tags) : link.aiTags,
        
        // Set final values
        finalDescription: description,
        finalCategory: category || link.aiCategory,
        finalTags: tags ? JSON.stringify(tags) : link.aiTags,
        
        updatedAt: now
      }

      // Update title if provided
      if (title) {
        updateData.title = title
      }

      // Set status and publish time based on publish flag
      if (publish) {
        updateData.status = 'published'
        updateData.publishedAt = now
      } else {
        updateData.status = 'draft'
        updateData.publishedAt = null
      }

      // Update the link
      await database
        .update(links)
        .set(updateData)
        .where(eq(links.id, id))

      const duration = Date.now() - startTime

      // Log successful operation
      await logOperation(
        'link_confirm',
        'links',
        id,
        { 
          url: link.url,
          title,
          description,
          category: category || link.aiCategory,
          tags: tags || (link.aiTags ? JSON.parse(link.aiTags) : []),
          publish,
          final_status: publish ? 'published' : 'draft'
        },
        tokenData?.id,
        undefined,
        clientIp,
        c.req.header('user-agent'),
        'success',
        undefined,
        duration
      )

      // Prepare response
      const responseData: ConfirmLinkResponse = {
        id: link.id,
        status: publish ? 'published' : 'draft'
      }

      if (publish) {
        responseData.publishedAt = new Date(now * 1000).toISOString()
      }

      // Trigger static file generation in background if published
      if (publish) {
        triggerStaticGeneration(database)
      }

      const message = publish ? 'Link confirmed and published successfully' : 'Link saved as draft successfully'
      return sendSuccess(c, responseData, message)

    } catch (error) {
      const duration = Date.now() - startTime
      const tokenData = c.get('tokenData')
      const clientIp = c.get('clientIp')
      
      await logOperation(
        'link_confirm',
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
      
      console.error('Error confirming link:', error)
      return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to confirm link', undefined, 500)
    }
  })

  return app
}

// Export both the router factory and a default instance
export { createConfirmLinkRouter }
export default createConfirmLinkRouter()