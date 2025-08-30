import { describe, it, expect, beforeEach } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { apiTokens } from '../db/schema.js'
import { createAddLinkRouter } from '../routes/auth/add-link.js'

describe('Auth Add Link API', () => {
  let app: any
  let testToken: string

  beforeEach(async () => {
    clearTestData()
    
    // Use real router with test database injection
    app = createAddLinkRouter(testDrizzle)
    
    // Create test API token
    const tokenResult = await testDrizzle
      .insert(apiTokens)
      .values({
        token: 'mgp_' + '0'.repeat(64), // Valid format test token
        name: 'Test Token',
        status: 'active',
        usageCount: 0,
        createdAt: Math.floor(Date.now() / 1000)
      })
      .returning({ token: apiTokens.token })

    testToken = tokenResult[0].token
  })

  describe('POST /', () => {
    it('should require authentication', async () => {
      const response = await app.request('/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: 'https://example.com'
        })
      })

      expect(response.status).toBe(401)
    })

    it('should validate required URL parameter', async () => {
      const response = await app.request('/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      expect(response.status).toBe(400)
    })

    it('should validate URL format', async () => {
      const response = await app.request('/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: 'invalid-url'
        })
      })

      expect(response.status).toBe(400)
    })
    
    // Note: Integration tests for complete flow with web scraping and AI analysis
    // are tested separately in their respective service test files.
    // These API tests focus on the route logic and basic validation.
  })
})