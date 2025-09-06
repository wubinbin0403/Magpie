import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/index.js'
import { links } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { sendSuccess, sendError, notFound } from '../../utils/response.js'
import { idParamSchema, confirmLinkSchema } from '../../utils/validation.js'
import { requireApiTokenOrAdminSession, logOperation } from '../../middleware/auth.js'
import { triggerStaticGeneration } from '../../services/static-generator.js'
import type { ConfirmLinkResponse } from '@magpie/shared'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

// Helper function to get unified auth data
function getAuthData(c: any) {
  const authType = c.get('authType')
  const tokenData = c.get('tokenData')
  const userData = c.get('userData')
  const clientIp = c.get('clientIp')
  
  if (authType === 'api_token') {
    return {
      userId: undefined, // API tokens don't have user association
      tokenId: tokenData?.id,
      clientIp,
      authType: 'api_token'
    }
  } else if (authType === 'admin_session' || authType === 'admin_jwt') {
    return {
      userId: userData?.id,
      tokenId: undefined,
      clientIp,
      authType: authType
    }
  }
  
  // Fallback for backward compatibility
  return {
    userId: tokenData ? undefined : userData?.id,
    tokenId: tokenData?.id,
    clientIp,
    authType: tokenData ? 'api_token' : 'admin_session'
  }
}

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
  app.post('/:id/confirm', requireApiTokenOrAdminSession(database), zValidator('param', idParamSchema), zValidator('json', confirmLinkSchema), async (c) => {
    const startTime = Date.now()
    
    try {
      const { id } = c.req.valid('param')
      const { title, description, category, tags, readingTime, publish = true } = c.req.valid('json')
      const authData = getAuthData(c)

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
          authData.tokenId,
          authData.userId,
          authData.clientIp,
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
          authData.tokenId,
          authData.userId,
          authData.clientIp,
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
        userCategory: (category && category.trim()) || link.aiCategory,
        userTags: tags ? JSON.stringify(tags) : link.aiTags,
        
        updatedAt: now
      }
      
      // Update reading time if provided
      if (readingTime !== undefined) {
        updateData.aiReadingTime = readingTime
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
        authData.tokenId,
        authData.userId,
        authData.clientIp,
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
      const authData = getAuthData(c)
      
      await logOperation(
        'link_confirm',
        'links',
        undefined,
        { error: String(error) },
        authData.tokenId,
        authData.userId,
        authData.clientIp,
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