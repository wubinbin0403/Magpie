import { Hono } from 'hono'
import { db } from '../../db/index.js'
import { categories, links } from '../../db/schema.js'
import { eq, asc, sql } from 'drizzle-orm'
import { sendSuccess, sendError } from '../../utils/response.js'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

// Create public categories router with optional database dependency injection
function createPublicCategoriesRouter(database = db) {
  const app = new Hono()

  // Error handling middleware
  app.onError((err, c) => {
    console.error('Public Categories API Error:', err)
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred', undefined, 500)
  })

  // GET /api/categories - 获取所有启用的分类（包含链接数量）
  app.get('/', async (c) => {
    try {
      // Get all active categories with link counts
      const result = await database
        .select({
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
          icon: categories.icon,
          description: categories.description,
          displayOrder: categories.displayOrder,
          linkCount: sql<number>`COALESCE((
            SELECT COUNT(*)
            FROM ${links}
            WHERE COALESCE(${links.userCategory}, ${links.aiCategory}) = ${categories.name}
            AND ${links.status} = 'published'
          ), 0)`,
        })
        .from(categories)
        .where(eq(categories.isActive, 1))
        .orderBy(asc(categories.displayOrder), asc(categories.name))

      return sendSuccess(c, result)
    } catch (error) {
      console.error('Error fetching public categories:', error)
      return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to fetch categories', undefined, 500)
    }
  })

  return app
}

// Export both the router factory and a default instance
export { createPublicCategoriesRouter }
export default createPublicCategoriesRouter()