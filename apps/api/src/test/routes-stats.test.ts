import { describe, it, expect, beforeEach } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { links } from '../db/schema.js'
import { createStatsRouter } from '../routes/public/stats.js'
import type { StatsResponse } from '../types/api.js'

describe('Public Stats API', () => {
  let app: any

  beforeEach(async () => {
    clearTestData()
    
    // Use real router with test database injection
    app = createStatsRouter(testDrizzle)
    
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

    it('should support timezone parameter for monthly statistics', async () => {
      // Test UTC timezone (default)
      const utcResponse = await app.request('/')
      const utcData = await utcResponse.json() as any
      
      expect(utcResponse.status).toBe(200)
      expect(utcData.success).toBe(true)
      
      // Test UTC+8 timezone (480 minutes offset)
      const utc8Response = await app.request('/?tz=480')
      const utc8Data = await utc8Response.json() as any
      
      expect(utc8Response.status).toBe(200)
      expect(utc8Data.success).toBe(true)
      
      // Both should have same structure
      expect(utc8Data.data.monthlyStats).toHaveLength(12)
      expect(utcData.data.monthlyStats).toHaveLength(12)
      
      // The timezone parameter should affect the monthly stats calculation
      const utcCurrentMonth = utcData.data.monthlyStats[utcData.data.monthlyStats.length - 1]
      const utc8CurrentMonth = utc8Data.data.monthlyStats[utc8Data.data.monthlyStats.length - 1]
      
      expect(utcCurrentMonth).toHaveProperty('year')
      expect(utcCurrentMonth).toHaveProperty('month')
      expect(utcCurrentMonth).toHaveProperty('count')
      expect(utc8CurrentMonth).toHaveProperty('year')
      expect(utc8CurrentMonth).toHaveProperty('month')
      expect(utc8CurrentMonth).toHaveProperty('count')
    })

    it('should handle invalid timezone parameter gracefully', async () => {
      // Test with invalid timezone
      const response = await app.request('/?tz=invalid')
      const data = await response.json() as any
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // Should default to UTC (tz=0)
      expect(data.data.monthlyStats).toHaveLength(12)
    })

    it('should handle negative timezone offset', async () => {
      // Test UTC-5 (Eastern Time, 300 minutes offset)
      const response = await app.request('/?tz=-300')
      const data = await response.json() as any
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.monthlyStats).toHaveLength(12)
    })
  })
})