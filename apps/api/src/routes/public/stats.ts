import { Hono } from 'hono'
import { db } from '../../db/index.js'
import { links } from '../../db/schema.js'
import { eq, desc, and, sql } from 'drizzle-orm'
import { sendSuccess, sendError } from '../../utils/response.js'
import { apiLogger } from '../../utils/logger.js'
import type { StatsResponse, ActivityItem, TagStats, DomainStats, MonthlyStats } from '@magpie/shared'

// Create stats router with optional database dependency injection
export function createStatsRouter(database = db) {
  const app = new Hono()

  // 添加错误处理中间件
  app.onError((err, c) => {
    apiLogger.error('Stats API error', {
      error: err instanceof Error ? err.message : err,
      stack: err instanceof Error ? err.stack : undefined
    })
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred', undefined, 500)
  })

  // GET /api/stats - 获取统计信息
  app.get('/', async (c) => {
    try {
      // Get timezone offset from query parameter (in minutes, e.g., -480 for UTC+8)
      const timezoneOffset = parseInt(c.req.query('tz') || '0') || 0
      // 获取链接总数和状态统计
      const linkStats = await database
        .select({
          status: links.status,
          count: sql<number>`count(*)`
        })
        .from(links)
        .groupBy(links.status)

      const totalLinks = linkStats.reduce((sum, stat) => sum + stat.count, 0)
      const publishedLinks = linkStats.find(stat => stat.status === 'published')?.count || 0
      const pendingLinks = linkStats.find(stat => stat.status === 'pending')?.count || 0

      // 获取分类统计 (直接使用user字段)
      const categoryStats = await database
      .select({
        category: links.userCategory,
        count: sql<number>`count(*)`
      })
      .from(links)
      .where(eq(links.status, 'published'))
      .groupBy(links.userCategory)
      .having(sql`${links.userCategory} IS NOT NULL`)

    const totalCategories = categoryStats.length

      // 获取标签统计 (直接使用user字段)
      const tagData = await database
      .select({ 
        tags: links.userTags 
      })
      .from(links)
      .where(eq(links.status, 'published'))

    const allTags = new Set<string>()
    const tagCounts: { [key: string]: number } = {}

    tagData.forEach(item => {
      if (item.tags) {
        try {
          const tags = JSON.parse(item.tags) as string[]
          tags.forEach((tag: string) => {
            allTags.add(tag)
            tagCounts[tag] = (tagCounts[tag] || 0) + 1
          })
        } catch (error) {
          // 忽略无效的JSON
          apiLogger.warn('Invalid tags JSON encountered while computing stats', {
            rawTags: item.tags
          })
        }
      }
    })

    const totalTags = allTags.size

    // 获取热门标签 (前10个)
    const popularTags: TagStats[] = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }))

      // 获取热门域名
      const domainStats = await database
      .select({
        domain: links.domain,
        count: sql<number>`count(*)`
      })
      .from(links)
      .where(eq(links.status, 'published'))
      .groupBy(links.domain)
      .orderBy(sql`count(*) desc`)
      .limit(10)

    const popularDomains: DomainStats[] = domainStats.map(stat => ({
      name: stat.domain,
      count: stat.count
    }))

      // 获取最近活动 (最近10个已发布的链接)
      const recentActivity = await database
      .select({
        title: links.title,
        url: links.url,
        publishedAt: links.publishedAt
      })
      .from(links)
      .where(eq(links.status, 'published'))
      .orderBy(desc(links.publishedAt))
      .limit(10)

    const activityItems: ActivityItem[] = recentActivity.map(item => ({
      type: 'link_published',
      title: item.title || 'Untitled',
      url: item.url,
      timestamp: item.publishedAt ? new Date(item.publishedAt * 1000).toISOString() : ''
    }))

    // 获取月度统计 (最近12个月)
    const now = new Date()
    const monthlyStats: MonthlyStats[] = []
    
    // Convert timezone offset from minutes to seconds
    const tzOffsetSeconds = timezoneOffset * 60
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      
      // Calculate month boundaries in user's timezone
      // We subtract the timezone offset from the timestamps to align with user's local time
      const startOfMonth = Math.floor(new Date(year, month - 1, 1).getTime() / 1000) - tzOffsetSeconds
      const endOfMonth = Math.floor(new Date(year, month, 0, 23, 59, 59, 999).getTime() / 1000) - tzOffsetSeconds

      const monthlyData = await database
        .select({ count: sql<number>`count(*)` })
        .from(links)
        .where(
          and(
            eq(links.status, 'published'),
            sql`${links.publishedAt} >= ${startOfMonth}`,
            sql`${links.publishedAt} <= ${endOfMonth}`
          )
        )


      monthlyStats.push({
        year,
        month,
        count: monthlyData[0].count
      })
    }

    const responseData: StatsResponse = {
      totalLinks,
      publishedLinks,
      pendingLinks,
      totalCategories,
      totalTags,
      recentActivity: activityItems,
      popularTags,
      popularDomains,
      monthlyStats
    }

    return sendSuccess(c, responseData)

    } catch (error) {
      apiLogger.error('Error fetching stats', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
      return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to fetch statistics', undefined, 500)
    }
  })

  return app
}

// Export the router instance for use in main app
const statsRouter = createStatsRouter()
export default statsRouter
