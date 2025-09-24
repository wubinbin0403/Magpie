import { db } from './index.js'
import { categories, settings } from './schema.js'
import { eq } from 'drizzle-orm'
import { createLogger } from '../utils/logger.js'

const seedLogger = createLogger('db-seed')

/**
 * Seed initial categories data
 */
export async function seedCategories() {
  seedLogger.info('Seeding categories')
  
  try {
    // Check if categories already exist
    const existingCategories = await db.select().from(categories)
    if (existingCategories.length > 0) {
      seedLogger.info('Categories already exist, skipping seed')
      return
    }
    
    const now = Math.floor(Date.now() / 1000)
    
    // Default categories with icons and colors
    const defaultCategories = [
      {
        name: '技术',
        slug: 'tech',
        icon: 'code',
        color: '#3B82F6',
        description: '编程、开发、技术相关内容',
        displayOrder: 1,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: '设计',
        slug: 'design',
        icon: 'palette',
        color: '#8B5CF6',
        description: '设计、UI/UX、创意相关内容',
        displayOrder: 2,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: '产品',
        slug: 'product',
        icon: 'cube',
        color: '#10B981',
        description: '产品管理、商业分析相关内容',
        displayOrder: 3,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: '工具',
        slug: 'tools',
        icon: 'wrench',
        color: '#F59E0B',
        description: '实用工具、软件推荐',
        displayOrder: 4,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: '游戏',
        slug: 'game',
        icon: 'game-controller',
        color: '#EC4899',
        description: '游戏相关内容',
        displayOrder: 5,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: '其他',
        slug: 'other',
        icon: 'folder',
        color: '#6B7280',
        description: '其他未分类内容',
        displayOrder: 99,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      }
    ]
    
    await db.insert(categories).values(defaultCategories)
    
    seedLogger.info('Seeded categories', { count: defaultCategories.length })
    
    // Update the categories in settings to match new format
    const categoryNames = defaultCategories.map(c => c.name)
    await db
      .update(settings)
      .set({ 
        value: JSON.stringify(categoryNames),
        updatedAt: now
      })
      .where(eq(settings.key, 'categories'))
    
    seedLogger.info('Updated categories setting to match seeded data')

  } catch (error) {
    seedLogger.error('Error seeding categories', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedCategories()
    .then(() => {
      seedLogger.info('Categories seeding completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      seedLogger.error('Categories seeding failed', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
      process.exit(1)
    })
}
