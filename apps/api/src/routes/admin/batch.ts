import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/index.js'
import { links } from '../../db/schema.js'
import { eq, inArray } from 'drizzle-orm'
import { sendSuccess, sendError } from '../../utils/response.js'
import { batchOperationSchema } from '../../utils/validation.js'
import { requireAdmin } from '../../middleware/admin.js'
import { triggerStaticGeneration } from '../../services/static-generator.js'

// Create admin batch operations router with optional database dependency injection
function createAdminBatchRouter(database = db) {
  const app = new Hono()

  // Error handling middleware
  app.onError((err, c) => {
    console.error('Admin Batch Operations API Error:', err)
    
    if (err.message.includes('ZodError') || err.name === 'ZodError') {
      return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
    }
    
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred', undefined, 500)
  })

  // POST /api/admin/pending/batch - Perform batch operations on links
  app.post('/batch', requireAdmin(database), zValidator('json', batchOperationSchema), async (c) => {
    try {
      const { ids, action, params } = c.req.valid('json')
      
      const now = Math.floor(Date.now() / 1000)
      const results: Array<{ id: number; success: boolean; error?: string }> = []
      let processed = 0
      let failed = 0
      let skipped = 0

      // Get all links to process with required fields
      const existingLinks = await database
        .select({
          id: links.id,
          status: links.status,
          userDescription: links.userDescription,
          aiSummary: links.aiSummary,
          originalDescription: links.originalDescription,
          userCategory: links.userCategory,
          aiCategory: links.aiCategory,
          userTags: links.userTags,
          aiTags: links.aiTags,
        })
        .from(links)
        .where(inArray(links.id, ids))

      // Create a map for quick lookup
      const linksMap = new Map(existingLinks.map(link => [link.id, link]))

      for (const id of ids) {
        const link = linksMap.get(id)
        
        if (!link) {
          results.push({ id, success: false, error: 'Link not found' })
          failed++
          continue
        }

        try {
          switch (action) {
            case 'confirm': {
              // Skip already deleted links
              if (link.status === 'deleted') {
                results.push({ id, success: true, error: 'Already deleted, skipped' })
                skipped++
                continue
              }

              // Prepare final values for publishing with proper fallback logic
              const finalDescription = params?.description || 
                link.userDescription || 
                link.aiSummary || 
                link.originalDescription || 
                ''
              
              const finalCategory = params?.category || 
                link.userCategory || 
                link.aiCategory || 
                ''
                
              // Determine final tags with proper priority: params -> user -> ai -> empty
              let tagsToUse: string[] = []
              if (params?.tags && params.tags.length > 0) {
                tagsToUse = params.tags
              } else if (link.userTags) {
                const userTags = JSON.parse(link.userTags)
                if (userTags && userTags.length > 0) {
                  tagsToUse = userTags
                }
              }
              if (tagsToUse.length === 0 && link.aiTags) {
                const aiTags = JSON.parse(link.aiTags)
                if (aiTags && aiTags.length > 0) {
                  tagsToUse = aiTags
                }
              }
              const finalTags = JSON.stringify(tagsToUse)

              // Update to published status - ALWAYS set user fields to ensure data is available
              const updateData: any = {
                status: 'published',
                publishedAt: now,
                updatedAt: now,
                // Always set user fields to preserve AI analysis results
                userDescription: finalDescription,
                userCategory: finalCategory,
                userTags: finalTags,
              }
              
              await database
                .update(links)
                .set(updateData)
                .where(eq(links.id, id))

              results.push({ id, success: true })
              processed++
              break
            }

            case 'delete': {
              // Skip already deleted links
              if (link.status === 'deleted') {
                results.push({ id, success: true, error: 'Already deleted, skipped' })
                skipped++
                continue
              }

              // Soft delete
              await database
                .update(links)
                .set({
                  status: 'deleted',
                  updatedAt: now,
                })
                .where(eq(links.id, id))

              results.push({ id, success: true })
              processed++
              break
            }

            case 'reanalyze': {
              // Skip deleted links
              if (link.status === 'deleted') {
                results.push({ id, success: true, error: 'Deleted link, skipped' })
                skipped++
                continue
              }

              // For now, just mark as pending and reset user overrides
              // In a real implementation, this would trigger AI reanalysis
              await database
                .update(links)
                .set({
                  status: 'pending',
                  userDescription: null,
                  userCategory: null,
                  userTags: null,
                  updatedAt: now,
                })
                .where(eq(links.id, id))

              results.push({ id, success: true })
              processed++
              break
            }

            default:
              results.push({ id, success: false, error: 'Unknown action' })
              failed++
          }
        } catch (error) {
          console.error(`Batch operation failed for link ${id}:`, error)
          results.push({ id, success: false, error: String(error) })
          failed++
        }
      }

      let message = `Batch ${action} operation completed.`
      if (action === 'reanalyze') {
        message = `Batch reanalysis queued for ${processed} links.`
      }

      // Trigger static file regeneration if any links were published or deleted
      if ((action === 'confirm' || action === 'delete') && processed > 0) {
        triggerStaticGeneration(database)
      }

      const responseData = {
        processed,
        failed,
        skipped,
        total: ids.length,
        results,
      }

      return sendSuccess(c, responseData, message)

    } catch (error) {
      console.error('Error performing batch operation:', error)
      return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to perform batch operation', undefined, 500)
    }
  })

  return app
}

// Export both the router factory and a default instance
export { createAdminBatchRouter }
export default createAdminBatchRouter()