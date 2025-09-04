import { describe, it, expect, beforeEach } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { Hono } from 'hono'
import { links } from '../db/schema.js'
import { eq, desc, and, sql } from 'drizzle-orm'
import { sendSuccess, sendError } from '../utils/response.js'
import type { StatsResponse } from '../types/api.js'

// 创建统计API
const createStatsApp = () => {
  const app = new Hono()

  app.onError((err, c) => {
    console.error('Stats API Error:', err)
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred', undefined, 500)
  })

  // GET /api/stats - 获取统计信息
  app.get('/', async (c) => {
    try {
      // 获取链接总数和状态统计
      const linkStats = await testDrizzle
        .select({
          status: links.status,
          count: sql<number>`count(*)`
        })
        .from(links)
        .groupBy(links.status)

      const totalLinks = linkStats.reduce((sum, stat) => sum + stat.count, 0)
      const publishedLinks = linkStats.find(stat => stat.status === 'published')?.count || 0
      const pendingLinks = linkStats.find(stat => stat.status === 'pending')?.count || 0

      // 获取分类统计
      const categoryStats = await testDrizzle
        .select({
          category: links.userCategory,
          count: sql<number>`count(*)`
        })
        .from(links)
        .where(eq(links.status, 'published'))
        .groupBy(links.userCategory)
        .having(sql`${links.userCategory} IS NOT NULL`)

      const totalCategories = categoryStats.length

      // 获取标签统计 (简化版本 - 统计唯一标签数量)
      const tagData = await testDrizzle
        .select({ tags: links.userTags })
        .from(links)
        .where(eq(links.status, 'published'))

      const allTags = new Set<string>()
      const tagCounts: { [key: string]: number } = {}

      tagData.forEach(item => {
        if (item.tags) {
          try {
            const tags = JSON.parse(item.tags)
            tags.forEach((tag: string) => {
              allTags.add(tag)
              tagCounts[tag] = (tagCounts[tag] || 0) + 1
            })
          } catch (error) {
            // 忽略无效的JSON
          }
        }
      })

      const totalTags = allTags.size

      // 获取热门标签 (前10个)
      const popularTags = Object.entries(tagCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }))

      // 获取热门域名
      const domainStats = await testDrizzle
        .select({
          domain: links.domain,
          count: sql<number>`count(*)`
        })
        .from(links)
        .where(eq(links.status, 'published'))
        .groupBy(links.domain)
        .orderBy(sql`count(*) desc`)
        .limit(10)

      const popularDomains = domainStats.map(stat => ({
        name: stat.domain,
        count: stat.count
      }))

      // 获取最近活动 (最近10个已发布的链接)
      const recentActivity = await testDrizzle
        .select({
          title: links.title,
          url: links.url,
          publishedAt: links.publishedAt
        })
        .from(links)
        .where(eq(links.status, 'published'))
        .orderBy(desc(links.publishedAt))
        .limit(10)

      const activityItems = recentActivity.map(item => ({
        type: 'link_published' as const,
        title: item.title || 'Untitled',
        url: item.url,
        timestamp: new Date(item.publishedAt * 1000).toISOString()
      }))

      // 获取月度统计 (最近12个月)
      const now = new Date()
      const monthlyStats = []
      
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const year = date.getFullYear()
        const month = date.getMonth() + 1
        const startOfMonth = Math.floor(new Date(year, month - 1, 1).getTime() / 1000)
        const endOfMonth = Math.floor(new Date(year, month, 0, 23, 59, 59).getTime() / 1000)

        const monthlyData = await testDrizzle
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

  return app
}

describe('Public Stats API', () => {
  let app: Hono

  beforeEach(async () => {
    clearTestData()
    app = createStatsApp()
    
    // 插入测试数据
    const now = Math.floor(Date.now() / 1000)
    const lastMonth = now - (30 * 24 * 60 * 60) // 30天前
    
    const insertData = [
      // 本月的已发布链接
      {
        url: 'https://example.com/react-tutorial',
        domain: 'example.com', 
        title: 'React Tutorial',
        originalDescription: 'React tutorial',
        aiSummary: 'React tutorial',
        userDescription: 'React tutorial',
        userDescription: 'React tutorial for beginners',
        userCategory: 'programming',
        userTags: '["react", "javascript", "tutorial"]',
        status: 'published',
        publishedAt: now - 3600,
        createdAt: now - 3600
      },
      {
        url: 'https://example.com/vue-guide',
        domain: 'example.com',
        title: 'Vue.js Guide', 
        originalDescription: 'Vue guide',
        aiSummary: 'Vue guide',
        userDescription: 'Vue guide',
        userDescription: 'Vue.js complete guide',
        userCategory: 'programming',
        userTags: '["vue", "javascript", "framework"]',
        status: 'published',
        publishedAt: now - 1800,
        createdAt: now - 1800
      },
      {
        url: 'https://tech.com/design-patterns',
        domain: 'tech.com',
        title: 'Design Patterns',
        originalDescription: 'Design patterns',
        aiSummary: 'Design patterns',
        userDescription: 'Design patterns',
        userDescription: 'Software design patterns',
        userCategory: 'architecture',
        userTags: '["patterns", "design", "software"]',
        status: 'published',
        publishedAt: now - 900,
        createdAt: now - 900
      },
      // 上月的链接
      {
        url: 'https://blog.com/old-article',
        domain: 'blog.com',
        title: 'Old Article',
        originalDescription: 'Old article',
        aiSummary: 'Old article',
        userDescription: 'Old article',
        userDescription: 'An old article from last month',
        userCategory: 'general',
        userTags: '["old", "archive"]',
        status: 'published',
        publishedAt: lastMonth,
        createdAt: lastMonth
      },
      // 待确认的链接
      {
        url: 'https://pending.com/pending-article',
        domain: 'pending.com',
        title: 'Pending Article',
        originalDescription: 'Pending article',
        aiSummary: 'Pending article',
        userDescription: null,
        userDescription: null,
        userCategory: null,
        userTags: null,
        status: 'pending',
        publishedAt: null,
        createdAt: now - 300
      }
    ]

    await testDrizzle.insert(links).values(insertData)
  })

  describe('GET /', () => {
    it('should return comprehensive statistics', async () => {
      const response = await app.request('/')
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      const stats = data.data
      
      // 基础统计
      expect(stats.totalLinks).toBe(5)
      expect(stats.publishedLinks).toBe(4)
      expect(stats.pendingLinks).toBe(1)
      expect(stats.totalCategories).toBeGreaterThan(0)
      expect(stats.totalTags).toBeGreaterThan(0)
      
      // 结构验证
      expect(stats.recentActivity).toBeInstanceOf(Array)
      expect(stats.popularTags).toBeInstanceOf(Array)
      expect(stats.popularDomains).toBeInstanceOf(Array)
      expect(stats.monthlyStats).toBeInstanceOf(Array)
    })

    it('should return recent activity with correct format', async () => {
      const response = await app.request('/')
      const data = await response.json() as any

      const activity = data.data.recentActivity
      expect(activity).toBeInstanceOf(Array)
      expect(activity.length).toBeGreaterThan(0)
      
      if (activity.length > 0) {
        expect(activity[0]).toHaveProperty('type', 'link_published')
        expect(activity[0]).toHaveProperty('title')
        expect(activity[0]).toHaveProperty('url')
        expect(activity[0]).toHaveProperty('timestamp')
      }
    })

    it('should return popular tags with counts', async () => {
      const response = await app.request('/')
      const data = await response.json() as any

      const tags = data.data.popularTags
      expect(tags).toBeInstanceOf(Array)
      
      tags.forEach((tag: any) => {
        expect(tag).toHaveProperty('name')
        expect(tag).toHaveProperty('count')
        expect(typeof tag.count).toBe('number')
        expect(tag.count).toBeGreaterThan(0)
      })
    })

    it('should return popular domains with counts', async () => {
      const response = await app.request('/')
      const data = await response.json() as any

      const domains = data.data.popularDomains
      expect(domains).toBeInstanceOf(Array)
      expect(domains.length).toBeGreaterThan(0)
      
      domains.forEach((domain: any) => {
        expect(domain).toHaveProperty('name')
        expect(domain).toHaveProperty('count')
        expect(typeof domain.count).toBe('number')
        expect(domain.count).toBeGreaterThan(0)
      })
    })

    it('should return monthly statistics', async () => {
      const response = await app.request('/')
      const data = await response.json() as any

      const monthly = data.data.monthlyStats
      expect(monthly).toBeInstanceOf(Array)
      expect(monthly.length).toBe(12) // 12个月的数据
      
      monthly.forEach((stat: any) => {
        expect(stat).toHaveProperty('year')
        expect(stat).toHaveProperty('month')
        expect(stat).toHaveProperty('count')
        expect(typeof stat.year).toBe('number')
        expect(typeof stat.month).toBe('number')
        expect(typeof stat.count).toBe('number')
        expect(stat.month).toBeGreaterThanOrEqual(1)
        expect(stat.month).toBeLessThanOrEqual(12)
      })
    })

    it('should handle empty database gracefully', async () => {
      // 清空数据库
      clearTestData()
      
      const response = await app.request('/')
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      const stats = data.data
      expect(stats.totalLinks).toBe(0)
      expect(stats.publishedLinks).toBe(0)
      expect(stats.pendingLinks).toBe(0)
      expect(stats.totalCategories).toBe(0)
      expect(stats.totalTags).toBe(0)
      expect(stats.recentActivity).toEqual([])
      expect(stats.popularTags).toEqual([])
      expect(stats.popularDomains).toEqual([])
      expect(stats.monthlyStats).toHaveLength(12) // 仍然返回12个月，但都是0
    })
  })
})