import { Hono } from 'hono'
import { db } from '../../db/index.js'
import { links } from '../../db/schema.js'
import { eq, desc, and, sql } from 'drizzle-orm'
import { sendSuccess, sendError } from '../../utils/response.js'
import type { StatsResponse, ActivityItem, TagStats, DomainStats, MonthlyStats } from '../../types/api.js'

const app = new Hono()

// 添加错误处理中间件
app.onError((err, c) => {
  console.error('Stats API Error:', err)
  return sendError(c, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred', undefined, 500)
})

// GET /api/stats - 获取统计信息
app.get('/', async (c) => {
  try {
    // 获取链接总数和状态统计
    const linkStats = await db
      .select({
        status: links.status,
        count: sql<number>`count(*)`
      })
      .from(links)
      .groupBy(links.status)

    const totalLinks = linkStats.reduce((sum, stat) => sum + stat.count, 0)
    const publishedLinks = linkStats.find(stat => stat.status === 'published')?.count || 0
    const pendingLinks = linkStats.find(stat => stat.status === 'pending')?.count || 0

    // 获取分类统计 (使用动态计算)
    const categoryStats = await db
      .select({
        category: sql<string>`COALESCE(${links.userCategory}, ${links.aiCategory})`,
        count: sql<number>`count(*)`
      })
      .from(links)
      .where(eq(links.status, 'published'))
      .groupBy(sql`COALESCE(${links.userCategory}, ${links.aiCategory})`)
      .having(sql`COALESCE(${links.userCategory}, ${links.aiCategory}) IS NOT NULL`)

    const totalCategories = categoryStats.length

    // 获取标签统计 (使用动态计算)
    const tagData = await db
      .select({ 
        tags: sql<string>`COALESCE(${links.userTags}, ${links.aiTags})` 
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
          console.warn('Invalid tags JSON:', item.tags)
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
    const domainStats = await db
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
    const recentActivity = await db
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
      timestamp: new Date(item.publishedAt * 1000).toISOString()
    }))

    // 获取月度统计 (最近12个月)
    const now = new Date()
    const monthlyStats: MonthlyStats[] = []
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const startOfMonth = Math.floor(new Date(year, month - 1, 1).getTime() / 1000)
      const endOfMonth = Math.floor(new Date(year, month, 0, 23, 59, 59).getTime() / 1000)

      const monthlyData = await db
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
    console.error('Error fetching stats:', error)
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to fetch statistics', undefined, 500)
  }
})

export default app