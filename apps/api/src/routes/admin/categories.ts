import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { HTTPException } from 'hono/http-exception'
import { db } from '../../db/index.js'
import { links, settings } from '../../db/schema.js'
import { eq, sql, count, and, isNotNull } from 'drizzle-orm'
import { sendSuccess, sendError, notFound } from '../../utils/response.js'
import { requireAdmin } from '../../middleware/admin.js'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

// Schema definitions
const categoriesQuerySchema = z.object({
  includeStats: z.string().optional().transform(val => {
    if (!val) return true
    return val.toLowerCase() !== 'false'
  }),
  status: z.enum(['all', 'published', 'pending']).default('published'),
})

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
})

const idParamSchema = z.object({
  id: z.coerce.number().min(1),
})

// Create admin categories router with optional database dependency injection
function createAdminCategoriesRouter(database = db) {
  const app = new Hono()

  // Error handling middleware
  app.onError((err, c) => {
    console.error('Admin Categories API Error:', err)
    
    if (err instanceof HTTPException && err.status === 400) {
      return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
    }
    
    if (err.message.includes('ZodError') || err.name === 'ZodError') {
      return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
    }
    
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred', undefined, 500)
  })

  // Helper function to get predefined categories from settings
  async function getPredefinedCategories(): Promise<string[]> {
    try {
      const categorySettings = await database
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, 'content.categories'))
        .limit(1)

      if (categorySettings.length > 0 && categorySettings[0].value) {
        return JSON.parse(categorySettings[0].value)
      }
      
      return []
    } catch (error) {
      console.error('Failed to get predefined categories:', error)
      return []
    }
  }

  // GET /api/admin/categories - Get category list with statistics
  app.get('/', requireAdmin(database), zValidator('query', categoriesQuerySchema, (result, c) => {
    if (!result.success) {
      return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
    }
  }), async (c) => {
    try {
      const { includeStats, status } = c.req.valid('query')

      // Get predefined categories from settings
      const predefinedCategories = await getPredefinedCategories()

      // Get categories from published/pending links with counts
      let whereConditions: any[] = [isNotNull(links.finalCategory)]
      
      if (status === 'published') {
        whereConditions.push(eq(links.status, 'published'))
      } else if (status === 'pending') {
        whereConditions.push(eq(links.status, 'pending'))
      }
      // 'all' includes both published and pending, no additional condition needed

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined

      if (includeStats !== false) {
        // Get categories with link counts
        const categoryStats = await database
          .select({
            category: links.finalCategory,
            linkCount: count(links.id)
          })
          .from(links)
          .where(whereClause)
          .groupBy(links.finalCategory)

        // Combine predefined and used categories
        const categoryMap = new Map<string, { name: string, linkCount: number, isPredefined: boolean }>()

        // Add predefined categories
        predefinedCategories.forEach(category => {
          categoryMap.set(category, {
            name: category,
            linkCount: 0,
            isPredefined: true
          })
        })

        // Update with actual usage stats
        categoryStats.forEach(stat => {
          if (stat.category) {
            const existing = categoryMap.get(stat.category)
            categoryMap.set(stat.category, {
              name: stat.category,
              linkCount: stat.linkCount,
              isPredefined: existing?.isPredefined || false
            })
          }
        })

        const categories = Array.from(categoryMap.values()).sort((a, b) => {
          // Sort by predefined first, then by link count descending, then alphabetically
          if (a.isPredefined && !b.isPredefined) return -1
          if (!a.isPredefined && b.isPredefined) return 1
          if (a.linkCount !== b.linkCount) return b.linkCount - a.linkCount
          return a.name.localeCompare(b.name)
        })

        return sendSuccess(c, { categories }, 'Categories retrieved successfully')
      } else {
        // Get unique categories without counts
        const usedCategories = await database
          .selectDistinct({ category: links.finalCategory })
          .from(links)
          .where(whereClause)

        // Combine with predefined categories
        const categorySet = new Set(predefinedCategories)
        usedCategories.forEach(row => {
          if (row.category) {
            categorySet.add(row.category)
          }
        })

        const categories = Array.from(categorySet)
          .sort()
          .map(name => ({ name, isPredefined: predefinedCategories.includes(name) }))

        return sendSuccess(c, { categories }, 'Categories retrieved successfully')
      }

    } catch (error) {
      console.error('Failed to get categories:', error)
      return sendError(c, 'DATABASE_ERROR', 'Failed to retrieve categories', undefined, 500)
    }
  })

  // POST /api/admin/categories - Create new predefined category
  app.post('/', requireAdmin(database), zValidator('json', createCategorySchema, (result, c) => {
    if (!result.success) {
      return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
    }
  }), async (c) => {
    try {
      const { name, description } = c.req.valid('json')

      // Get current predefined categories
      const predefinedCategories = await getPredefinedCategories()

      // Check if category already exists
      if (predefinedCategories.includes(name)) {
        return sendError(c, 'DUPLICATE_CATEGORY', 'Category already exists', undefined, 409)
      }

      // Add new category
      const updatedCategories = [...predefinedCategories, name].sort()

      // Update settings
      const now = Math.floor(Date.now() / 1000)
      await database
        .insert(settings)
        .values({
          key: 'content.categories',
          value: JSON.stringify(updatedCategories),
          type: 'json',
          description: 'Predefined content categories',
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: JSON.stringify(updatedCategories),
            updatedAt: now,
          }
        })

      return sendSuccess(c, { 
        name, 
        description, 
        isPredefined: true 
      }, 'Category created successfully', 201)

    } catch (error) {
      console.error('Failed to create category:', error)
      return sendError(c, 'DATABASE_ERROR', 'Failed to create category', undefined, 500)
    }
  })

  // PUT /api/admin/categories/:id - Update predefined category (by name, using position as "id")
  app.put('/:id', requireAdmin(database), zValidator('param', idParamSchema, (result, c) => {
    if (!result.success) {
      return sendError(c, 'VALIDATION_ERROR', 'Invalid parameters', undefined, 400)
    }
  }), zValidator('json', updateCategorySchema, (result, c) => {
    if (!result.success) {
      return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
    }
  }), async (c) => {
    try {
      const { id } = c.req.valid('param')
      const { name: newName, description } = c.req.valid('json')

      // Get current predefined categories
      const predefinedCategories = await getPredefinedCategories()

      // Check if ID (position) is valid
      if (id < 1 || id > predefinedCategories.length) {
        return notFound(c, 'Category not found')
      }

      const oldName = predefinedCategories[id - 1]

      // If name is being changed, check for duplicates
      if (newName && newName !== oldName) {
        if (predefinedCategories.includes(newName)) {
          return sendError(c, 'DUPLICATE_CATEGORY', 'Category name already exists', undefined, 409)
        }

        // Update all links that use this category
        await database
          .update(links)
          .set({ finalCategory: newName })
          .where(eq(links.finalCategory, oldName))

        // Update predefined categories list
        const updatedCategories = [...predefinedCategories]
        updatedCategories[id - 1] = newName
        updatedCategories.sort()

        const now = Math.floor(Date.now() / 1000)
        await database
          .insert(settings)
          .values({
            key: 'content.categories',
            value: JSON.stringify(updatedCategories),
            type: 'json',
            description: 'Predefined content categories',
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: settings.key,
            set: {
              value: JSON.stringify(updatedCategories),
              updatedAt: now,
            }
          })
      }

      return sendSuccess(c, { 
        id, 
        name: newName || oldName, 
        description,
        isPredefined: true 
      }, 'Category updated successfully')

    } catch (error) {
      console.error('Failed to update category:', error)
      return sendError(c, 'DATABASE_ERROR', 'Failed to update category', undefined, 500)
    }
  })

  // DELETE /api/admin/categories/:id - Delete predefined category (by position)
  app.delete('/:id', requireAdmin(database), zValidator('param', idParamSchema, (result, c) => {
    if (!result.success) {
      return sendError(c, 'VALIDATION_ERROR', 'Invalid parameters', undefined, 400)
    }
  }), async (c) => {
    try {
      const { id } = c.req.valid('param')

      // Get current predefined categories
      const predefinedCategories = await getPredefinedCategories()

      // Check if ID (position) is valid
      if (id < 1 || id > predefinedCategories.length) {
        return notFound(c, 'Category not found')
      }

      const categoryToDelete = predefinedCategories[id - 1]

      // Check if category is in use
      const usage = await database
        .select({ count: count(links.id) })
        .from(links)
        .where(eq(links.finalCategory, categoryToDelete))

      if (usage[0].count > 0) {
        return sendError(c, 'CATEGORY_IN_USE', `Cannot delete category "${categoryToDelete}" as it is used by ${usage[0].count} link(s)`, undefined, 409)
      }

      // Remove category from predefined list
      const updatedCategories = predefinedCategories.filter((_, index) => index !== id - 1)

      const now = Math.floor(Date.now() / 1000)
      await database
        .insert(settings)
        .values({
          key: 'content.categories',
          value: JSON.stringify(updatedCategories),
          type: 'json',
          description: 'Predefined content categories',
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: JSON.stringify(updatedCategories),
            updatedAt: now,
          }
        })

      return sendSuccess(c, { 
        id, 
        name: categoryToDelete 
      }, 'Category deleted successfully')

    } catch (error) {
      console.error('Failed to delete category:', error)
      return sendError(c, 'DATABASE_ERROR', 'Failed to delete category', undefined, 500)
    }
  })

  return app
}

// Export both the router factory and a default instance
export { createAdminCategoriesRouter }
export default createAdminCategoriesRouter()