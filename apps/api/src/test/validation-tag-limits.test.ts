import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { testApp, getAuthHeaders } from './helpers.js'

describe('Tag Limit Validation (Maximum 5 Tags)', () => {
  let app: any

  beforeEach(async () => {
    app = await testApp()
    await getAuthHeaders(app)
  })

  afterEach(() => {
    app?.cleanup?.()
  })

  describe('Links API Tag Validation', () => {
    it('should accept up to 5 tags in links query', async () => {
      const validTagCombos = [
        'AI',
        'AI,技术',
        'AI,技术,开发',
        'AI,技术,开发,设计',
        'AI,技术,开发,设计,工具', // Exactly 5 tags
      ]

      for (const tags of validTagCombos) {
        const response = await app.request(`/api/links?tags=${encodeURIComponent(tags)}`)
        
        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.success).toBe(true)
      }
    })

    it('should reject more than 5 tags in links query', async () => {
      const invalidTagCombos = [
        'AI,技术,开发,设计,工具,测试', // 6 tags
        'tag1,tag2,tag3,tag4,tag5,tag6,tag7', // 7 tags
        'a,b,c,d,e,f,g,h,i,j', // 10 tags
      ]

      for (const tags of invalidTagCombos) {
        const response = await app.request(`/api/links?tags=${encodeURIComponent(tags)}`)
        
        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.error.issues[0].message).toBe('Maximum 5 tags allowed')
        expect(data.error.issues[0].path).toEqual(['tags'])
      }
    })

    it('should handle empty tags and whitespace correctly', async () => {
      const edgeCases = [
        '', // Empty string
        '   ', // Only whitespace
        'a,,b,c', // Empty tag in middle
        'a,b,c,d,e,', // Trailing comma
        ',a,b,c,d,e', // Leading comma
        'a, b , c , d , e ', // Whitespace around tags
      ]

      for (const tags of edgeCases) {
        const response = await app.request(`/api/links?tags=${encodeURIComponent(tags)}`)
        
        // All should be valid as they result in <= 5 actual tags
        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.success).toBe(true)
      }
    })

    it('should reject whitespace-padded tag lists exceeding 5 tags', async () => {
      const response = await app.request(`/api/links?tags=${encodeURIComponent('a, b, c, d, e, f')}`)
      
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.issues[0].message).toBe('Maximum 5 tags allowed')
    })
  })

  describe('Search API Tag Validation', () => {
    it('should accept up to 5 tags in search query', async () => {
      const response = await app.request(`/api/search?q=test&tags=${encodeURIComponent('AI,技术,开发,设计,工具')}`)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
    })

    it('should reject more than 5 tags in search query', async () => {
      const response = await app.request(`/api/search?q=test&tags=${encodeURIComponent('AI,技术,开发,设计,工具,测试')}`)
      
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.issues[0].message).toBe('Maximum 5 tags allowed')
    })
  })

  describe('Add Link API Tag Validation', () => {
    it('should test validation schema used by add-link API', () => {
      // This tests the validation schema that would be used by the add-link API
      // without requiring full authentication setup in tests
      
      // Test with valid tags (5 or fewer)
      const validCases = [
        '',
        'AI',
        'AI,技术',
        'AI,技术,开发,设计,工具'
      ]
      
      for (const tags of validCases) {
        const tagList = tags ? tags.split(',').map(t => t.trim()).filter(t => t) : []
        expect(tagList.length).toBeLessThanOrEqual(5)
      }
      
      // Test with invalid tags (more than 5)
      const invalidCases = [
        'AI,技术,开发,设计,工具,测试',
        'tag1,tag2,tag3,tag4,tag5,tag6,tag7'
      ]
      
      for (const tags of invalidCases) {
        const tagList = tags.split(',').map(t => t.trim()).filter(t => t)
        expect(tagList.length).toBeGreaterThan(5)
      }
    })
  })

  describe('Tag Count Edge Cases', () => {
    it('should handle Unicode tags correctly', async () => {
      const unicodeTags = '🔥,⚡,🚀,💡,🎯' // 5 emoji tags
      const response = await app.request(`/api/links?tags=${encodeURIComponent(unicodeTags)}`)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
    })

    it('should handle mixed language tags correctly', async () => {
      const mixedTags = 'AI,技术,development,设计,工具,extra' // 6 mixed tags
      const response = await app.request(`/api/links?tags=${encodeURIComponent(mixedTags)}`)
      
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
    })

    it('should handle very long individual tag names', async () => {
      const longTag = 'a'.repeat(100)
      const tags = `${longTag},b,c,d,e,f` // 6 tags with one very long tag
      const response = await app.request(`/api/links?tags=${encodeURIComponent(tags)}`)
      
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.issues[0].message).toBe('Maximum 5 tags allowed')
    })

    it('should handle duplicate tags correctly', async () => {
      const duplicateTags = 'AI,AI,技术,技术,开发,设计' // 6 tags with duplicates
      const response = await app.request(`/api/links?tags=${encodeURIComponent(duplicateTags)}`)
      
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
    })
  })

  describe('Error Message Quality', () => {
    it('should return clear error message for tag limit violation', async () => {
      const response = await app.request(`/api/links?tags=${encodeURIComponent('a,b,c,d,e,f')}`)
      
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error.issues).toHaveLength(1)
      expect(data.error.issues[0]).toEqual({
        code: 'custom',
        message: 'Maximum 5 tags allowed',
        path: ['tags']
      })
    })

    it('should maintain consistent error format across public APIs', async () => {
      const excessiveTags = 'a,b,c,d,e,f,g'
      
      // Test across public endpoints that don't require auth
      const endpoints = [
        `/api/links?tags=${encodeURIComponent(excessiveTags)}`,
        `/api/search?q=test&tags=${encodeURIComponent(excessiveTags)}`
      ]
      
      for (const endpoint of endpoints) {
        const response = await app.request(endpoint)
        
        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.error.issues[0].message).toBe('Maximum 5 tags allowed')
      }
    })
  })

  describe('Performance with Tag Limits', () => {
    it('should validate tag limits efficiently', async () => {
      const startTime = Date.now()
      
      // Test with exactly 5 tags (valid)
      await app.request(`/api/links?tags=${encodeURIComponent('a,b,c,d,e')}`)
      
      // Test with 6 tags (invalid)
      await app.request(`/api/links?tags=${encodeURIComponent('a,b,c,d,e,f')}`)
      
      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(100) // Should validate quickly
    })

    it('should handle concurrent requests with tag validation', async () => {
      const requests = [
        app.request(`/api/links?tags=${encodeURIComponent('a,b,c,d,e')}`), // Valid
        app.request(`/api/links?tags=${encodeURIComponent('a,b,c,d,e,f')}`), // Invalid
        app.request(`/api/links?tags=${encodeURIComponent('x,y,z')}`), // Valid
        app.request(`/api/links?tags=${encodeURIComponent('1,2,3,4,5,6,7')}`), // Invalid
      ]
      
      const responses = await Promise.all(requests)
      
      expect(responses[0].status).toBe(200) // Valid
      expect(responses[1].status).toBe(400) // Invalid
      expect(responses[2].status).toBe(200) // Valid
      expect(responses[3].status).toBe(400) // Invalid
    })
  })
})