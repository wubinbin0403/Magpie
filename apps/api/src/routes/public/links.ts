import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/index.js'
import { links } from '../../db/schema.js'
import { eq, desc, asc, like, and, or, count, sql } from 'drizzle-orm'
import { sendSuccess, sendError, notFound, badRequest } from '../../utils/response.js'
import { linksQuerySchema, idParamSchema, buildDateFilter } from '../../utils/validation.js'
import type { LinksResponse, Link, Pagination } from '../../types/api.js'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

// Create public links router with optional database dependency injection
function createLinksRouter(database = db) {
  const app = new Hono()

// 添加验证错误处理中间件
app.onError((err, c) => {
  console.error('Links API Error:', err)
  
  // zod验证错误
  if (err.message.includes('ZodError') || err.name === 'ZodError') {
    return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
  }
  
  return sendError(c, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred', undefined, 500)
})

// GET /api/links - 获取链接列表
app.get('/', zValidator('query', linksQuerySchema), async (c) => {
  try {
    const { page, limit, category, tags, search, domain, year, month, sort } = c.req.valid('query')
    
    const offset = (page - 1) * limit
    
    // 构建查询条件
    let whereConditions: any[] = [eq(links.status, 'published')]
    
    if (category) {
      whereConditions.push(eq(links.finalCategory, category))
    }
    
    if (domain) {
      whereConditions.push(eq(links.domain, domain))
    }
    
    if (search) {
      whereConditions.push(
        or(
          like(links.title, `%${search}%`),
          like(links.finalDescription, `%${search}%`),
          like(links.finalTags, `%${search}%`)
        )
      )
    }
    
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim())
      const tagConditions = tagList.map(tag => 
        like(links.finalTags, `%${tag}%`)
      )
      whereConditions.push(or(...tagConditions))
    }
    
    // 日期筛选
    const dateFilter = buildDateFilter(year, month)
    if (dateFilter) {
      whereConditions.push(
        and(
          sql`${links.publishedAt} >= ${dateFilter.start}`,
          sql`${links.publishedAt} <= ${dateFilter.end}`
        )
      )
    }
    
    const whereClause = and(...whereConditions)
    
    // 构建排序
    let orderBy: any
    switch (sort) {
      case 'oldest':
        orderBy = asc(links.publishedAt)
        break
      case 'title':
        orderBy = asc(links.title)
        break
      case 'domain':
        orderBy = asc(links.domain)
        break
      default: // newest
        orderBy = desc(links.publishedAt)
    }
    
    // 获取总数
    const totalResult = await database
      .select({ count: count() })
      .from(links)
      .where(whereClause)
    
    const total = totalResult[0].count
    
    // 获取链接列表
    const linksResult = await database
      .select({
        id: links.id,
        url: links.url,
        title: links.title,
        description: links.finalDescription,
        category: links.finalCategory,
        tags: links.finalTags,
        domain: links.domain,
        publishedAt: links.publishedAt,
        createdAt: links.createdAt,
      })
      .from(links)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset)
    
    // 格式化响应数据
    const formattedLinks: Link[] = linksResult.map(link => ({
      id: link.id,
      url: link.url,
      title: link.title || '',
      description: link.description || '',
      category: link.category || '',
      tags: link.tags ? JSON.parse(link.tags) : [],
      domain: link.domain,
      publishedAt: new Date(link.publishedAt * 1000).toISOString(),
      createdAt: new Date(link.createdAt * 1000).toISOString(),
    }))
    
    const pages = Math.ceil(total / limit)
    
    const pagination: Pagination = {
      page,
      limit,
      total,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1,
    }
    
    // 获取filters统计数据
    const [categoryStats, domainStats, tagData, yearMonthData] = await Promise.all([
      // 分类统计
      database
        .select({
          name: links.finalCategory,
          count: sql<number>`count(*)`
        })
        .from(links)
        .where(eq(links.status, 'published'))
        .groupBy(links.finalCategory)
        .having(sql`${links.finalCategory} IS NOT NULL AND ${links.finalCategory} != ''`)
        .orderBy(sql`count(*) desc`),

      // 域名统计  
      database
        .select({
          name: links.domain,
          count: sql<number>`count(*)`
        })
        .from(links)
        .where(eq(links.status, 'published'))
        .groupBy(links.domain)
        .orderBy(sql`count(*) desc`),

      // 标签数据（需要进一步处理）
      database
        .select({ tags: links.finalTags })
        .from(links)
        .where(eq(links.status, 'published')),

      // 年月数据
      database
        .select({ 
          publishedAt: links.publishedAt,
          count: sql<number>`count(*)`
        })
        .from(links)
        .where(eq(links.status, 'published'))
        .groupBy(sql`strftime('%Y-%m', datetime(${links.publishedAt}, 'unixepoch'))`)
        .orderBy(desc(links.publishedAt))
    ])

    // 处理标签统计
    const tagCounts: { [key: string]: number } = {}
    tagData.forEach(item => {
      if (item.tags) {
        try {
          const tags = JSON.parse(item.tags) as string[]
          tags.forEach((tag: string) => {
            if (tag.trim()) {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1
            }
          })
        } catch (error) {
          // 忽略无效的JSON
        }
      }
    })

    const tagStats = Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // 处理年月统计
    const yearMonthStats = yearMonthData.map(item => {
      const date = new Date(item.publishedAt * 1000)
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        count: item.count
      }
    })

    const filters = {
      categories: categoryStats,
      tags: tagStats,
      domains: domainStats,
      yearMonths: yearMonthStats,
    }
    
    const responseData: LinksResponse = {
      links: formattedLinks,
      pagination,
      filters,
    }
    
    return sendSuccess(c, responseData)
    
  } catch (error) {
    console.error('Error fetching links:', error)
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to fetch links', undefined, 500)
  }
})

// GET /api/links/:id - 获取单个链接详情
app.get('/:id', zValidator('param', idParamSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    
    const linkResult = await database
      .select({
        id: links.id,
        url: links.url,
        title: links.title,
        description: links.finalDescription,
        category: links.finalCategory,
        tags: links.finalTags,
        domain: links.domain,
        publishedAt: links.publishedAt,
        createdAt: links.createdAt,
      })
      .from(links)
      .where(and(eq(links.id, id), eq(links.status, 'published')))
      .limit(1)
    
    if (linkResult.length === 0) {
      return notFound(c, 'Link not found')
    }
    
    const link = linkResult[0]
    
    const formattedLink: Link = {
      id: link.id,
      url: link.url,
      title: link.title || '',
      description: link.description || '',
      category: link.category || '',
      tags: link.tags ? JSON.parse(link.tags) : [],
      domain: link.domain,
      publishedAt: new Date(link.publishedAt * 1000).toISOString(),
      createdAt: new Date(link.createdAt * 1000).toISOString(),
    }
    
    return sendSuccess(c, formattedLink)
    
  } catch (error) {
    console.error('Error fetching link:', error)
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to fetch link', undefined, 500)
  }
})

  return app
}

// Export both the router factory and a default instance
export { createLinksRouter }
export default createLinksRouter()