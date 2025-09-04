import { describe, it, expect, beforeEach } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { links } from '../db/schema.js'
import { createLinksRouter } from '../routes/public/links.js'

describe('Public Links API', () => {
  let app: any

  beforeEach(async () => {
    clearTestData()
    
    // Use real router with test database injection
    app = createLinksRouter(testDrizzle)
  })

  describe('GET /', () => {
    it('should return empty list when no published links exist', async () => {
      const response = await app.request('/')
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.links).toEqual([])
      expect(data.data.pagination.total).toBe(0)
    })

    it('should return published links', async () => {
      // Create test data
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/published',
            domain: 'example.com',
            title: 'Published Link',
            userDescription: 'Published description',
            userCategory: 'test',
            userTags: JSON.stringify(['tag1', 'tag2']),
            aiReadingTime: 5,
            status: 'published',
            publishedAt: now,
            createdAt: now,
          },
          {
            url: 'https://example.com/pending',
            domain: 'example.com',
            title: 'Pending Link',
            status: 'pending',
            createdAt: now,
          }
        ])

      const response = await app.request('/')
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.links).toHaveLength(1)
      expect(data.data.links[0].title).toBe('Published Link')
      expect(data.data.links[0].tags).toEqual(['tag1', 'tag2'])
      expect(data.data.links[0].readingTime).toBe(5)
      expect(data.data.pagination.total).toBe(1)
    })

    it('should support pagination', async () => {
      // Create multiple published links
      const now = Math.floor(Date.now() / 1000)
      const linkData = Array.from({ length: 25 }, (_, i) => ({
        url: `https://example.com/link-${i}`,
        domain: 'example.com',
        title: `Link ${i}`,
        userDescription: `Description ${i}`,
        userCategory: 'test',
        userTags: '[]',
        status: 'published' as const,
        publishedAt: now + i,
        createdAt: now + i,
      }))

      await testDrizzle.insert(links).values(linkData)

      // Test first page
      const response1 = await app.request('/?page=1&limit=10')
      const data1 = await response1.json() as any

      expect(response1.status).toBe(200)
      expect(data1.data.links).toHaveLength(10)
      expect(data1.data.pagination.page).toBe(1)
      expect(data1.data.pagination.total).toBe(25)
      expect(data1.data.pagination.pages).toBe(3)
      expect(data1.data.pagination.hasNext).toBe(true)
      expect(data1.data.pagination.hasPrev).toBe(false)

      // Test second page
      const response2 = await app.request('/?page=2&limit=10')
      const data2 = await response2.json() as any

      expect(data2.data.links).toHaveLength(10)
      expect(data2.data.pagination.page).toBe(2)
      expect(data2.data.pagination.hasNext).toBe(true)
      expect(data2.data.pagination.hasPrev).toBe(true)

      // Test last page
      const response3 = await app.request('/?page=3&limit=10')
      const data3 = await response3.json() as any

      expect(data3.data.links).toHaveLength(5)
      expect(data3.data.pagination.page).toBe(3)
      expect(data3.data.pagination.hasNext).toBe(false)
      expect(data3.data.pagination.hasPrev).toBe(true)
    })

    it('should filter by category', async () => {
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/tech',
            domain: 'example.com',
            title: 'Tech Link',
            userDescription: 'Tech description',
            userCategory: 'tech',
            userTags: '[]',
            status: 'published',
            publishedAt: now,
            createdAt: now,
          },
          {
            url: 'https://example.com/art',
            domain: 'example.com',
            title: 'Art Link',
            userDescription: 'Art description',
            userCategory: 'art',
            userTags: '[]',
            status: 'published',
            publishedAt: now,
            createdAt: now,
          }
        ])

      const response = await app.request('/?category=tech')
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.data.links).toHaveLength(1)
      expect(data.data.links[0].category).toBe('tech')
    })

    it('should filter by domain', async () => {
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/test',
            domain: 'example.com',
            title: 'Example Link',
            userDescription: 'Example description',
            userCategory: 'test',
            userTags: '[]',
            status: 'published',
            publishedAt: now,
            createdAt: now,
          },
          {
            url: 'https://another.com/test',
            domain: 'another.com',
            title: 'Another Link',
            userDescription: 'Another description',
            userCategory: 'test',
            userTags: '[]',
            status: 'published',
            publishedAt: now,
            createdAt: now,
          }
        ])

      const response = await app.request('/?domain=example.com')
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.data.links).toHaveLength(1)
      expect(data.data.links[0].domain).toBe('example.com')
    })

    it('should search in title and description', async () => {
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/test1',
            domain: 'example.com',
            title: 'React Tutorial',
            userDescription: 'Learn React hooks',
            userCategory: 'tech',
            userTags: '[]',
            status: 'published',
            publishedAt: now,
            createdAt: now,
          },
          {
            url: 'https://example.com/test2',
            domain: 'example.com',
            title: 'Vue Guide',
            userDescription: 'Vue composition API',
            userCategory: 'tech',
            userTags: '[]',
            status: 'published',
            publishedAt: now,
            createdAt: now,
          }
        ])

      const response = await app.request('/?search=React')
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.data.links).toHaveLength(1)
      expect(data.data.links[0].title).toBe('React Tutorial')
    })

    it('should sort links correctly', async () => {
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/old',
            domain: 'example.com',
            title: 'Old Link',
            userDescription: 'Old description',
            userCategory: 'test',
            userTags: '[]',
            status: 'published',
            publishedAt: now - 100,
            createdAt: now - 100,
          },
          {
            url: 'https://example.com/new',
            domain: 'example.com',
            title: 'New Link',
            userDescription: 'New description',
            userCategory: 'test',
            userTags: '[]',
            status: 'published',
            publishedAt: now,
            createdAt: now,
          }
        ])

      // Test newest first (default)
      const newestResponse = await app.request('/')
      const newestData = await newestResponse.json() as any
      expect(newestData.data.links[0].title).toBe('New Link')

      // Test oldest first
      const oldestResponse = await app.request('/?sort=oldest')
      const oldestData = await oldestResponse.json() as any
      expect(oldestData.data.links[0].title).toBe('Old Link')
    })

    it('should filter by tags', async () => {
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/react',
            domain: 'example.com',
            title: 'React Link',
            userDescription: 'React description',
            userCategory: 'tech',
            userTags: JSON.stringify(['react', 'frontend']),
            status: 'published',
            publishedAt: now,
            createdAt: now,
          },
          {
            url: 'https://example.com/nodejs',
            domain: 'example.com',
            title: 'Node.js Link',
            userDescription: 'Node.js description',
            userCategory: 'tech',
            userTags: JSON.stringify(['nodejs', 'backend']),
            status: 'published',
            publishedAt: now,
            createdAt: now,
          }
        ])

      const response = await app.request('/?tags=react')
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.data.links).toHaveLength(1)
      expect(data.data.links[0].tags).toContain('react')
    })

    it('should filter by year and month', async () => {
      const jan2024 = Math.floor(new Date('2024-01-15').getTime() / 1000)
      const feb2024 = Math.floor(new Date('2024-02-15').getTime() / 1000)
      
      await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/jan',
            domain: 'example.com',
            title: 'January Link',
            userDescription: 'January description',
            userCategory: 'test',
            userTags: '[]',
            status: 'published',
            publishedAt: jan2024,
            createdAt: jan2024,
          },
          {
            url: 'https://example.com/feb',
            domain: 'example.com',
            title: 'February Link',
            userDescription: 'February description',
            userCategory: 'test',
            userTags: '[]',
            status: 'published',
            publishedAt: feb2024,
            createdAt: feb2024,
          }
        ])

      // Filter by year only
      const yearResponse = await app.request('/?year=2024')
      const yearData = await yearResponse.json() as any
      expect(yearData.data.links).toHaveLength(2)

      // Filter by year and month
      const monthResponse = await app.request('/?year=2024&month=1')
      const monthData = await monthResponse.json() as any
      expect(monthData.data.links).toHaveLength(1)
      expect(monthData.data.links[0].title).toBe('January Link')
    })
  })

  describe('GET /:id', () => {
    it('should return 404 for non-existent link', async () => {
      const response = await app.request('/99999')
      const data = await response.json() as any

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should return 404 for non-published link', async () => {
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/pending',
          domain: 'example.com',
          title: 'Pending Link',
          status: 'pending',
          createdAt: now,
        })
        .returning({ id: links.id })

      const response = await app.request(`/${linkResult[0].id}`)
      const data = await response.json() as any

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })

    it('should return published link details', async () => {
      const now = Math.floor(Date.now() / 1000)
      const linkResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/published',
          domain: 'example.com',
          title: 'Published Link',
          userDescription: 'This is a published link',
          userCategory: 'tech',
          userTags: JSON.stringify(['react', 'frontend']),
          aiReadingTime: 8,
          status: 'published',
          publishedAt: now,
          createdAt: now,
        })
        .returning({ id: links.id })

      const response = await app.request(`/${linkResult[0].id}`)
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(linkResult[0].id)
      expect(data.data.title).toBe('Published Link')
      expect(data.data.description).toBe('This is a published link')
      expect(data.data.category).toBe('tech')
      expect(data.data.tags).toEqual(['react', 'frontend'])
      expect(data.data.domain).toBe('example.com')
      expect(data.data.url).toBe('https://example.com/published')
      expect(data.data.readingTime).toBe(8)
    })

    it('should handle readingTime field properly', async () => {
      const now = Math.floor(Date.now() / 1000)
      const linksResult = await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/with-reading-time',
            domain: 'example.com',
            title: 'Link with Reading Time',
            userDescription: 'Has reading time',
            userCategory: 'tech',
            userTags: '[]',
            aiReadingTime: 10,
            status: 'published',
            publishedAt: now,
            createdAt: now,
          },
          {
            url: 'https://example.com/without-reading-time',
            domain: 'example.com',
            title: 'Link without Reading Time',
            userDescription: 'No reading time',
            userCategory: 'tech',
            userTags: '[]',
            aiReadingTime: null,
            status: 'published',
            publishedAt: now + 1,
            createdAt: now + 1,
          }
        ])
        .returning({ id: links.id })

      // Test list endpoint includes readingTime
      const listResponse = await app.request('/')
      const listData = await listResponse.json() as any

      expect(listResponse.status).toBe(200)
      expect(listData.success).toBe(true)
      expect(listData.data.links).toHaveLength(2)
      
      const linkWithTime = listData.data.links.find((l: any) => l.title === 'Link with Reading Time')
      const linkWithoutTime = listData.data.links.find((l: any) => l.title === 'Link without Reading Time')
      
      expect(linkWithTime.readingTime).toBe(10)
      expect(linkWithoutTime.readingTime).toBeUndefined()

      // Test detail endpoint includes readingTime
      const detailResponse = await app.request(`/${linksResult[0].id}`)
      const detailData = await detailResponse.json() as any

      expect(detailResponse.status).toBe(200)
      expect(detailData.success).toBe(true)
      expect(detailData.data.readingTime).toBe(10)
    })

    it('should validate ID parameter', async () => {
      const response = await app.request('/invalid-id')
      const data = await response.json() as any

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  describe('filters statistics', () => {
    it('should return correct filter statistics', async () => {
      const now = Math.floor(Date.now() / 1000)
      const jan2024 = Math.floor(new Date('2024-01-15').getTime() / 1000)
      const feb2024 = Math.floor(new Date('2024-02-15').getTime() / 1000)
      
      await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/react',
            domain: 'example.com',
            title: 'React Tutorial',
            userDescription: 'Learn React hooks',
            userCategory: 'Tech',
            userTags: JSON.stringify(['react', 'frontend', 'javascript']),
            status: 'published',
            publishedAt: jan2024,
            createdAt: jan2024,
          },
          {
            url: 'https://github.com/vue',
            domain: 'github.com',
            title: 'Vue Guide',
            userDescription: 'Vue composition API',
            userCategory: 'Tech',
            userTags: JSON.stringify(['vue', 'frontend', 'javascript']),
            status: 'published',
            publishedAt: feb2024,
            createdAt: feb2024,
          },
          {
            url: 'https://design.com/art',
            domain: 'design.com',
            title: 'Design Principles',
            userDescription: 'UI/UX design guide',
            userCategory: 'Design',
            userTags: JSON.stringify(['design', 'ui', 'ux']),
            status: 'published',
            publishedAt: now,
            createdAt: now,
          },
          {
            url: 'https://example.com/pending',
            domain: 'example.com', 
            title: 'Pending Link',
            userDescription: 'Should not appear in filters',
            userCategory: 'Other',
            userTags: JSON.stringify(['pending']),
            status: 'pending',
            createdAt: now,
          }
        ])

      const response = await app.request('/')
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      const { filters } = data.data

      // 检查分类统计 (只包含published链接)
      expect(filters.categories).toHaveLength(2)
      expect(filters.categories.find((c: any) => c.name === 'Tech')).toEqual({ name: 'Tech', count: 2 })
      expect(filters.categories.find((c: any) => c.name === 'Design')).toEqual({ name: 'Design', count: 1 })
      expect(filters.categories.find((c: any) => c.name === 'Other')).toBeUndefined() // pending链接不应包含

      // 域名统计已移除，现在通过独立的domains API按需获取
      expect(filters.domains).toBeUndefined()

      // 检查标签统计
      expect(filters.tags.length).toBeGreaterThan(0)
      const frontendTag = filters.tags.find((t: any) => t.name === 'frontend')
      const javascriptTag = filters.tags.find((t: any) => t.name === 'javascript') 
      const designTag = filters.tags.find((t: any) => t.name === 'design')
      
      expect(frontendTag).toEqual({ name: 'frontend', count: 2 })
      expect(javascriptTag).toEqual({ name: 'javascript', count: 2 })
      expect(designTag).toEqual({ name: 'design', count: 1 })
      expect(filters.tags.find((t: any) => t.name === 'pending')).toBeUndefined() // pending标签不应包含

      // 检查年月统计 
      expect(filters.yearMonths.length).toBeGreaterThan(0)
      expect(filters.yearMonths.some((ym: any) => ym.year === 2024 && ym.month === 1 && ym.count === 1)).toBe(true)
      expect(filters.yearMonths.some((ym: any) => ym.year === 2024 && ym.month === 2 && ym.count === 1)).toBe(true)
    })

    it('should return empty filters when no published links exist', async () => {
      // 只添加pending状态的链接
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/pending',
          domain: 'example.com',
          title: 'Pending Link',
          status: 'pending',
          createdAt: now,
        })

      const response = await app.request('/')
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.links).toHaveLength(0)
      expect(data.data.filters.categories).toHaveLength(0)
      expect(data.data.filters.tags).toHaveLength(0)
      expect(data.data.filters.domains).toBeUndefined()
      expect(data.data.filters.yearMonths).toHaveLength(0)
    })

    it('should handle links with empty or null category/tags', async () => {
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/no-category',
            domain: 'example.com',
            title: 'Link without category',
            userDescription: 'No category set',
            userCategory: null,
            userTags: '[]',
            status: 'published',
            publishedAt: now,
            createdAt: now,
          },
          {
            url: 'https://example.com/empty-category',
            domain: 'example.com',
            title: 'Link with empty category',
            userDescription: 'Empty category',
            userCategory: '',
            userTags: null,
            status: 'published',
            publishedAt: now,
            createdAt: now,
          }
        ])

      const response = await app.request('/')
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // 空值/null分类不应出现在统计中
      expect(data.data.filters.categories).toHaveLength(0)
      expect(data.data.filters.tags).toHaveLength(0)
      expect(data.data.filters.domains).toBeUndefined()
    })
  })
})