import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { categories } from '../../db/schema.js'
import { eq, asc, desc, sql } from 'drizzle-orm'
import { sendSuccess, sendError, notFound } from '../../utils/response.js'
import { requireAdmin } from '../../middleware/admin.js'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

// Validation schemas
const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
  icon: z.string().min(1).max(50).default('folder'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  description: z.string().max(200).optional(),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.number().int().min(0).max(1).default(1),
})

const updateCategorySchema = createCategorySchema.partial()

const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(val => parseInt(val, 10)),
})

const reorderSchema = z.object({
  categoryIds: z.array(z.number().int().positive()),
})

// Available preset icons
const PRESET_ICONS = [
  'code', 'cube', 'palette', 'wrench', 'folder', 'game-controller',
  'book', 'video', 'music', 'photo', 'document', 'globe',
  'chat', 'shopping', 'academic'
]

// Create categories router with optional database dependency injection
function createAdminCategoriesRouter(database = db) {
  const app = new Hono()

  // Error handling middleware
  app.onError((err, c) => {
    console.error('Categories API Error:', err)
    
    if (err.message.includes('ZodError') || err.name === 'ZodError') {
      return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
    }
    
    if (err.message.includes('UNIQUE constraint failed')) {
      return sendError(c, 'DUPLICATE_ERROR', 'Category name or slug already exists', undefined, 409)
    }
    
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred', undefined, 500)
  })

  // GET /api/admin/categories - 获取所有分类
  app.get('/', requireAdmin(database), async (c) => {
    try {
      const result = await database
        .select({
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
          icon: categories.icon,
          color: categories.color,
          description: categories.description,
          displayOrder: categories.displayOrder,
          isActive: categories.isActive,
          createdAt: categories.createdAt,
          updatedAt: categories.updatedAt,
        })
        .from(categories)
        .orderBy(asc(categories.displayOrder), asc(categories.name))

      return sendSuccess(c, result)
    } catch (error) {
      console.error('Error fetching categories:', error)
      return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to fetch categories', undefined, 500)
    }
  })

  // GET /api/admin/categories/icons - 获取可用图标列表
  app.get('/icons', requireAdmin(database), async (c) => {
    return sendSuccess(c, PRESET_ICONS)
  })

  // GET /api/admin/categories/:id - 获取单个分类
  app.get('/:id', requireAdmin(database), zValidator('param', idParamSchema), async (c) => {
    try {
      const { id } = c.req.valid('param')
      
      const result = await database
        .select()
        .from(categories)
        .where(eq(categories.id, id))
        .limit(1)
      
      if (result.length === 0) {
        return notFound(c, 'Category not found')
      }
      
      return sendSuccess(c, result[0])
    } catch (error) {
      console.error('Error fetching category:', error)
      return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to fetch category', undefined, 500)
    }
  })

  // POST /api/admin/categories - 创建新分类
  app.post('/', requireAdmin(database), zValidator('json', createCategorySchema), async (c) => {
    try {
      const data = c.req.valid('json')
      const now = Math.floor(Date.now() / 1000)
      
      // Generate slug if not provided
      if (!data.slug) {
        data.slug = data.name.toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '')
      }
      
      const insertData = {
        name: data.name,
        slug: data.slug,
        icon: data.icon,
        color: data.color || null,
        description: data.description || null,
        displayOrder: data.displayOrder,
        isActive: data.isActive,
        createdAt: now,
        updatedAt: now,
      }
      
      const result = await database
        .insert(categories)
        .values(insertData)
        .returning()
      
      return sendSuccess(c, result[0], 'Category created successfully', 201)
    } catch (error) {
      console.error('Error creating category:', error)
      
      if (error.message.includes('UNIQUE constraint failed')) {
        return sendError(c, 'DUPLICATE_ERROR', 'Category name or slug already exists', undefined, 409)
      }
      
      return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to create category', undefined, 500)
    }
  })

  // PUT /api/admin/categories/:id - 更新分类
  app.put('/:id', requireAdmin(database), zValidator('param', idParamSchema), zValidator('json', updateCategorySchema), async (c) => {
    try {
      const { id } = c.req.valid('param')
      const data = c.req.valid('json')
      const now = Math.floor(Date.now() / 1000)
      
      // Check if category exists
      const existingCategory = await database
        .select()
        .from(categories)
        .where(eq(categories.id, id))
        .limit(1)
      
      if (existingCategory.length === 0) {
        return notFound(c, 'Category not found')
      }
      
      // Generate slug if name is updated but slug is not provided
      if (data.name && !data.slug) {
        data.slug = data.name.toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '')
      }
      
      const updateData = {
        ...data,
        updatedAt: now,
      }
      
      const result = await database
        .update(categories)
        .set(updateData)
        .where(eq(categories.id, id))
        .returning()
      
      return sendSuccess(c, result[0], 'Category updated successfully')
    } catch (error) {
      console.error('Error updating category:', error)
      
      if (error.message.includes('UNIQUE constraint failed')) {
        return sendError(c, 'DUPLICATE_ERROR', 'Category name or slug already exists', undefined, 409)
      }
      
      return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to update category', undefined, 500)
    }
  })

  // DELETE /api/admin/categories/:id - 删除分类
  app.delete('/:id', requireAdmin(database), zValidator('param', idParamSchema), async (c) => {
    try {
      const { id } = c.req.valid('param')
      
      // Check if category exists
      const existingCategory = await database
        .select()
        .from(categories)
        .where(eq(categories.id, id))
        .limit(1)
      
      if (existingCategory.length === 0) {
        return notFound(c, 'Category not found')
      }
      
      // TODO: Check if category is being used by links
      // For now, we'll allow deletion but you might want to add a check
      
      await database
        .delete(categories)
        .where(eq(categories.id, id))
      
      return sendSuccess(c, null, 'Category deleted successfully')
    } catch (error) {
      console.error('Error deleting category:', error)
      return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to delete category', undefined, 500)
    }
  })

  // POST /api/admin/categories/reorder - 重新排序分类
  app.post('/reorder', requireAdmin(database), zValidator('json', reorderSchema), async (c) => {
    try {
      const { categoryIds } = c.req.valid('json')
      const now = Math.floor(Date.now() / 1000)
      
      // Update display order for each category
      const updates = categoryIds.map((categoryId, index) =>
        database
          .update(categories)
          .set({ 
            displayOrder: index + 1,
            updatedAt: now
          })
          .where(eq(categories.id, categoryId))
      )
      
      await Promise.all(updates)
      
      return sendSuccess(c, null, 'Categories reordered successfully')
    } catch (error) {
      console.error('Error reordering categories:', error)
      return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to reorder categories', undefined, 500)
    }
  })

  return app
}

// Export both the router factory and a default instance
export { createAdminCategoriesRouter }
export default createAdminCategoriesRouter()