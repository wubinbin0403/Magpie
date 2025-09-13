import { describe, it, expect, beforeEach } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { links, users } from '../db/schema.js'
import { createAdminLinksRouter } from '../routes/admin/links.js'
import { hashPassword, createAdminJWT } from '../utils/auth.js'
import { eq } from 'drizzle-orm'

describe('Admin Links API', () => {
  let app: any
  let adminToken: string

  beforeEach(async () => {
    clearTestData()
    
    // Use real router with test database injection
    app = createAdminLinksRouter(testDrizzle)
    
    // Create admin user and token
    const { hash, salt } = await hashPassword('admin123')
    const now = Math.floor(Date.now() / 1000)
    
    const adminResult = await testDrizzle
      .insert(users)
      .values({
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: hash,
        salt: salt,
        role: 'admin',
        status: 'active',
        createdAt: now,
      })
      .returning({ id: users.id })

    adminToken = createAdminJWT({
      userId: adminResult[0].id,
      username: 'admin',
      role: 'admin'
    })
  })

  describe('GET /', () => {
    it('should require admin authentication', async () => {
      const response = await app.request('/')
      const data = await response.json() as any

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })

    it('should return empty list when no links exist', async () => {
      const response = await app.request('/', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const data = await response.json() as any

      if (response.status !== 200) {
        // Log error response for debugging
      }
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.links).toEqual([])
      expect(data.data.pagination.total).toBe(0)
    })

    it('should return all links when status=all (default)', async () => {
      // Create test data with different statuses
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/published',
            domain: 'example.com',
            title: 'Published Link',
            userDescription: 'Published description',
            userCategory: 'tech',
            userTags: JSON.stringify(['published']),
            status: 'published',
            publishedAt: now,
            createdAt: now,
            aiReadingTime: 5,
          },
          {
            url: 'https://example.com/pending',
            domain: 'example.com',
            title: 'Pending Link',
            originalDescription: 'Original description',
            aiSummary: 'AI summary',
            aiCategory: 'tech',
            aiTags: JSON.stringify(['pending']),
            status: 'pending',
            createdAt: now,
          },
          {
            url: 'https://example.com/deleted',
            domain: 'example.com',
            title: 'Deleted Link',
            userDescription: 'Deleted description',
            userCategory: 'tech',
            userTags: JSON.stringify(['deleted']),
            status: 'deleted',
            createdAt: now,
          }
        ])

      const response = await app.request('/', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.links).toHaveLength(3)
      expect(data.data.pagination.total).toBe(3)
      
      // Check that all statuses are included
      const statuses = data.data.links.map((link: any) => link.status)
      expect(statuses).toContain('published')
      expect(statuses).toContain('pending')
      expect(statuses).toContain('deleted')
    })

    it('should filter links by status', async () => {
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
            userCategory: 'tech',
            userTags: JSON.stringify(['published']),
            status: 'published',
            publishedAt: now,
            createdAt: now,
          },
          {
            url: 'https://example.com/pending',
            domain: 'example.com',
            title: 'Pending Link',
            aiSummary: 'AI summary',
            aiCategory: 'tech',
            aiTags: JSON.stringify(['pending']),
            status: 'pending',
            createdAt: now,
          }
        ])

      // Test published filter
      const publishedResponse = await app.request('/?status=published', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const publishedData = await publishedResponse.json() as any

      expect(publishedResponse.status).toBe(200)
      expect(publishedData.data.links).toHaveLength(1)
      expect(publishedData.data.links[0].status).toBe('published')

      // Test pending filter
      const pendingResponse = await app.request('/?status=pending', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const pendingData = await pendingResponse.json() as any

      expect(pendingResponse.status).toBe(200)
      expect(pendingData.data.links).toHaveLength(1)
      expect(pendingData.data.links[0].status).toBe('pending')
    })

    it('should search links by title, description, and domain', async () => {
      // Create test data
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://react.dev/article1',
            domain: 'react.dev',
            title: 'React Hooks Guide',
            userDescription: 'Learn about React hooks',
            userCategory: 'programming',
            userTags: JSON.stringify(['react', 'hooks']),
            status: 'published',
            publishedAt: now,
            createdAt: now,
          },
          {
            url: 'https://vue.org/article2',
            domain: 'vue.org',
            title: 'Vue.js Tutorial',
            aiSummary: 'Introduction to Vue.js framework',
            aiCategory: 'programming',
            aiTags: JSON.stringify(['vue', 'tutorial']),
            status: 'pending',
            createdAt: now,
          },
          {
            url: 'https://angular.io/article3',
            domain: 'angular.io',
            title: 'Angular Components',
            userDescription: 'Building Angular components',
            userCategory: 'programming',
            userTags: JSON.stringify(['angular']),
            status: 'published',
            publishedAt: now,
            createdAt: now,
          }
        ])

      // Search by title
      const titleSearchResponse = await app.request('/?search=React', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const titleSearchData = await titleSearchResponse.json() as any

      expect(titleSearchResponse.status).toBe(200)
      expect(titleSearchData.data.links).toHaveLength(1)
      expect(titleSearchData.data.links[0].title).toBe('React Hooks Guide')

      // Search by domain
      const domainSearchResponse = await app.request('/?search=vue.org', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const domainSearchData = await domainSearchResponse.json() as any

      expect(domainSearchResponse.status).toBe(200)
      expect(domainSearchData.data.links).toHaveLength(1)
      expect(domainSearchData.data.links[0].domain).toBe('vue.org')

      // Search by description
      const descSearchResponse = await app.request('/?search=framework', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const descSearchData = await descSearchResponse.json() as any

      expect(descSearchResponse.status).toBe(200)
      expect(descSearchData.data.links).toHaveLength(1)
      expect(descSearchData.data.links[0].title).toBe('Vue.js Tutorial')
    })

    it('should search links by ID', async () => {
      // Create test data
      const now = Math.floor(Date.now() / 1000)
      const insertResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/searchable',
          domain: 'example.com',
          title: 'Searchable Link',
          userDescription: 'Test link for ID search',
          userCategory: 'test',
          userTags: JSON.stringify(['test']),
          status: 'published',
          publishedAt: now,
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = insertResult[0].id

      // Search by ID
      const idSearchResponse = await app.request(`/?search=${linkId}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const idSearchData = await idSearchResponse.json() as any

      expect(idSearchResponse.status).toBe(200)
      expect(idSearchData.data.links).toHaveLength(1)
      expect(idSearchData.data.links[0].id).toBe(linkId)
    })

    it('should support pagination', async () => {
      // Create test data
      const now = Math.floor(Date.now() / 1000)
      const testLinks = Array.from({ length: 25 }, (_, i) => ({
        url: `https://example.com/link${i + 1}`,
        domain: 'example.com',
        title: `Test Link ${i + 1}`,
        userDescription: `Description ${i + 1}`,
        userCategory: 'test',
        userTags: JSON.stringify(['test']),
        status: 'published' as const,
        publishedAt: now + i,
        createdAt: now + i,
      }))

      await testDrizzle.insert(links).values(testLinks)

      // Test first page
      const page1Response = await app.request('/?page=1&limit=10', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const page1Data = await page1Response.json() as any

      expect(page1Response.status).toBe(200)
      expect(page1Data.data.links).toHaveLength(10)
      expect(page1Data.data.pagination.page).toBe(1)
      expect(page1Data.data.pagination.limit).toBe(10)
      expect(page1Data.data.pagination.total).toBe(25)
      expect(page1Data.data.pagination.totalPages).toBe(3)

      // Test second page
      const page2Response = await app.request('/?page=2&limit=10', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const page2Data = await page2Response.json() as any

      expect(page2Response.status).toBe(200)
      expect(page2Data.data.links).toHaveLength(10)
      expect(page2Data.data.pagination.page).toBe(2)

      // Test last page
      const page3Response = await app.request('/?page=3&limit=10', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const page3Data = await page3Response.json() as any

      expect(page3Response.status).toBe(200)
      expect(page3Data.data.links).toHaveLength(5)
      expect(page3Data.data.pagination.page).toBe(3)
    })

    it('should support different sorting options', async () => {
      // Create test data with different creation times and titles
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/zebra',
            domain: 'example.com',
            title: 'Zebra Article',
            userDescription: 'About zebras',
            status: 'published',
            publishedAt: now - 100,
            createdAt: now - 100,
          },
          {
            url: 'https://example.com/alpha',
            domain: 'example.com',
            title: 'Alpha Article',
            userDescription: 'About alphas',
            status: 'published',
            publishedAt: now,
            createdAt: now,
          },
          {
            url: 'https://beta.com/article',
            domain: 'beta.com',
            title: 'Beta Article',
            userDescription: 'About betas',
            status: 'published',
            publishedAt: now - 50,
            createdAt: now - 50,
          }
        ])

      // Test newest first (default)
      const newestResponse = await app.request('/?sort=newest', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const newestData = await newestResponse.json() as any

      expect(newestResponse.status).toBe(200)
      expect(newestData.data.links[0].title).toBe('Alpha Article')
      expect(newestData.data.links[2].title).toBe('Zebra Article')

      // Test oldest first
      const oldestResponse = await app.request('/?sort=oldest', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const oldestData = await oldestResponse.json() as any

      expect(oldestResponse.status).toBe(200)
      expect(oldestData.data.links[0].title).toBe('Zebra Article')
      expect(oldestData.data.links[2].title).toBe('Alpha Article')

      // Test title sort
      const titleResponse = await app.request('/?sort=title', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const titleData = await titleResponse.json() as any

      expect(titleResponse.status).toBe(200)
      expect(titleData.data.links[0].title).toBe('Alpha Article')
      expect(titleData.data.links[1].title).toBe('Beta Article')
      expect(titleData.data.links[2].title).toBe('Zebra Article')

      // Test domain sort
      const domainResponse = await app.request('/?sort=domain', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const domainData = await domainResponse.json() as any

      expect(domainResponse.status).toBe(200)
      expect(domainData.data.links[0].domain).toBe('beta.com')
      expect(domainData.data.links[1].domain).toBe('example.com')
      expect(domainData.data.links[2].domain).toBe('example.com')
    })

    it('should filter by category', async () => {
      // Create test data
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://example.com/tech',
            domain: 'example.com',
            title: 'Tech Article',
            userCategory: 'technology',
            status: 'published',
            publishedAt: now,
            createdAt: now,
          },
          {
            url: 'https://example.com/design',
            domain: 'example.com',
            title: 'Design Article',
            aiCategory: 'design',
            status: 'pending',
            createdAt: now,
          },
          {
            url: 'https://example.com/business',
            domain: 'example.com',
            title: 'Business Article',
            userCategory: 'business',
            status: 'published',
            publishedAt: now,
            createdAt: now,
          }
        ])

      // Filter by technology category
      const techResponse = await app.request('/?category=technology', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const techData = await techResponse.json() as any

      expect(techResponse.status).toBe(200)
      expect(techData.data.links).toHaveLength(1)
      expect(techData.data.links[0].category).toBe('technology')

      // Filter by design category (from AI)
      const designResponse = await app.request('/?category=design', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const designData = await designResponse.json() as any

      expect(designResponse.status).toBe(200)
      expect(designData.data.links).toHaveLength(1)
      expect(designData.data.links[0].category).toBe('design')
    })

    it('should filter by domain', async () => {
      // Create test data
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle
        .insert(links)
        .values([
          {
            url: 'https://github.com/repo1',
            domain: 'github.com',
            title: 'GitHub Article 1',
            status: 'published',
            publishedAt: now,
            createdAt: now,
          },
          {
            url: 'https://github.com/repo2',
            domain: 'github.com',
            title: 'GitHub Article 2',
            status: 'published',
            publishedAt: now,
            createdAt: now,
          },
          {
            url: 'https://stackoverflow.com/question',
            domain: 'stackoverflow.com',
            title: 'Stack Overflow Question',
            status: 'published',
            publishedAt: now,
            createdAt: now,
          }
        ])

      // Filter by GitHub domain
      const githubResponse = await app.request('/?domain=github.com', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const githubData = await githubResponse.json() as any

      expect(githubResponse.status).toBe(200)
      expect(githubData.data.links).toHaveLength(2)
      expect(githubData.data.links.every((link: any) => link.domain === 'github.com')).toBe(true)
    })

    it('should handle invalid query parameters gracefully', async () => {
      const response = await app.request('/?page=0&limit=101&status=invalid', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      
      expect(response.status).toBe(400)
      const data = await response.json() as any
      expect(data.success).toBe(false)
    })

    it('should return proper data structure for links', async () => {
      // Create test data with all possible fields
      const now = Math.floor(Date.now() / 1000)
      await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/complete',
          domain: 'example.com',
          title: 'Complete Link',
          originalDescription: 'Original description',
          userDescription: 'User description',
          aiSummary: 'AI summary',
          aiCategory: 'ai-category',
          userCategory: 'user-category',
          aiTags: JSON.stringify(['ai-tag1', 'ai-tag2']),
          userTags: JSON.stringify(['user-tag1', 'user-tag2']),
          status: 'published',
          publishedAt: now,
          createdAt: now - 100,
          aiReadingTime: 7,
        })

      const response = await app.request('/', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      const link = data.data.links[0]
      expect(link).toHaveProperty('id')
      expect(link).toHaveProperty('url', 'https://example.com/complete')
      expect(link).toHaveProperty('title', 'Complete Link')
      expect(link).toHaveProperty('domain', 'example.com')
      expect(link).toHaveProperty('description', 'User description') // User description preferred
      expect(link).toHaveProperty('category', 'user-category') // User category preferred
      expect(link).toHaveProperty('tags', ['user-tag1', 'user-tag2']) // User tags preferred
      expect(link).toHaveProperty('status', 'published')
      expect(link).toHaveProperty('createdAt', now - 100)
      expect(link).toHaveProperty('publishedAt', now)
      expect(link).toHaveProperty('readingTime', 7)
    })
  })

  describe('PUT /:id', () => {
    it('should require admin authentication', async () => {
      const response = await app.request('/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Updated Title'
        })
      })
      
      expect(response.status).toBe(401)
    })

    it('should return 404 for non-existent link', async () => {
      const response = await app.request('/99999', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Updated Title'
        })
      })
      
      expect(response.status).toBe(404)
      const data = await response.json() as any
      expect(data.success).toBe(false)
    })

    it('should update link fields', async () => {
      // Create test link
      const now = Math.floor(Date.now() / 1000)
      const insertResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/original',
          domain: 'example.com',
          title: 'Original Title',
          userDescription: 'Original description',
          userCategory: 'original-category',
          userTags: JSON.stringify(['original']),
          status: 'pending',
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = insertResult[0].id

      // Update the link
      const response = await app.request(`/${linkId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Updated Title',
          description: 'Updated description',
          category: 'updated-category',
          tags: ['updated', 'new'],
          status: 'published'
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
      
      const updatedLink = data.data
      expect(updatedLink.title).toBe('Updated Title')
      expect(updatedLink.description).toBe('Updated description')
      expect(updatedLink.category).toBe('updated-category')
      expect(updatedLink.tags).toEqual(['updated', 'new'])
      expect(updatedLink.status).toBe('published')
      expect(updatedLink.publishedAt).toBeDefined()
    })

    it('should handle status change to published', async () => {
      // Create test link in pending status
      const now = Math.floor(Date.now() / 1000)
      const insertResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/pending',
          domain: 'example.com',
          title: 'Pending Link',
          userDescription: 'Pending description',
          status: 'pending',
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = insertResult[0].id

      // Update status to published
      const response = await app.request(`/${linkId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'published'
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
      
      const updatedLink = data.data
      expect(updatedLink.status).toBe('published')
      expect(updatedLink.publishedAt).toBeDefined()
      expect(updatedLink.publishedAt).toBeGreaterThan(0)
    })
  })

  describe('DELETE /:id', () => {
    it('should require admin authentication', async () => {
      const response = await app.request('/1', {
        method: 'DELETE'
      })
      
      expect(response.status).toBe(401)
    })

    it('should return 404 for non-existent link', async () => {
      const response = await app.request('/99999', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })
      
      expect(response.status).toBe(404)
      const data = await response.json() as any
      expect(data.success).toBe(false)
      expect(data.error.message).toBe('Link not found')
    })

    it('should delete link by setting status to deleted', async () => {
      // Create test link
      const now = Math.floor(Date.now() / 1000)
      const insertResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/to-delete',
          domain: 'example.com',
          title: 'Link to Delete',
          userDescription: 'This will be deleted',
          userCategory: 'test',
          userTags: JSON.stringify(['test']),
          status: 'published',
          publishedAt: now,
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = insertResult[0].id

      // Delete the link
      const response = await app.request(`/${linkId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
      expect(data.data.message).toBe('Link deleted successfully')

      // Verify the link status is now 'deleted'
      const deletedLink = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.id, linkId))
        .limit(1)

      expect(deletedLink[0].status).toBe('deleted')
      expect(deletedLink[0].updatedAt).toBeDefined()
    })

    it('should be able to delete pending links', async () => {
      // Create test link with pending status
      const now = Math.floor(Date.now() / 1000)
      const insertResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/pending-delete',
          domain: 'example.com',
          title: 'Pending Link to Delete',
          aiSummary: 'AI generated summary',
          status: 'pending',
          createdAt: now,
        })
        .returning({ id: links.id })

      const linkId = insertResult[0].id

      // Delete the pending link
      const response = await app.request(`/${linkId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)

      // Verify the link status is now 'deleted'
      const deletedLink = await testDrizzle
        .select()
        .from(links)
        .where(eq(links.id, linkId))
        .limit(1)

      expect(deletedLink[0].status).toBe('deleted')
    })

    it('should be able to delete already deleted links (idempotent)', async () => {
      // Create test link with deleted status
      const now = Math.floor(Date.now() / 1000)
      const insertResult = await testDrizzle
        .insert(links)
        .values({
          url: 'https://example.com/already-deleted',
          domain: 'example.com',
          title: 'Already Deleted Link',
          status: 'deleted',
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: links.id })

      const linkId = insertResult[0].id

      // Try to delete again
      const response = await app.request(`/${linkId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
      expect(data.data.message).toBe('Link deleted successfully')
    })
  })
})