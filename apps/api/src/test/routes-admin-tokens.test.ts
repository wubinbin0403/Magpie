import { describe, it, expect, beforeEach } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { apiTokens, users } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { hashPassword, createAdminJWT } from '../utils/auth.js'
import { createAdminTokensRouter } from '../routes/admin/tokens.js'

describe('Admin Tokens API', () => {
  let app: any
  let jwtToken: string
  let adminUserId: number

  beforeEach(async () => {
    clearTestData()

    // Use real router with test database injection
    app = createAdminTokensRouter(testDrizzle)

    // Create admin user
    const { hash, salt } = await hashPassword('admin123')
    const now = Math.floor(Date.now() / 1000)
    const userResult = await testDrizzle.insert(users).values({
      username: 'admin',
      passwordHash: hash,
      salt,
      role: 'admin',
      status: 'active',
      createdAt: now,
    }).returning({ id: users.id })

    adminUserId = userResult[0].id

    // Create JWT token for admin
    jwtToken = createAdminJWT({
      userId: adminUserId,
      username: 'admin',
      role: 'admin'
    })

    // Create some test tokens
    const testTokens = [
      {
        token: 'mgp_active_token_1',
        name: 'Test Token 1',
        prefix: 'mgp_',
        status: 'active' as const,
        usageCount: 15,
        lastUsedAt: now - 3600, // 1 hour ago
        lastUsedIp: '192.168.1.100',
        createdAt: now - 86400, // 1 day ago
      },
      {
        token: 'mgp_active_token_2', 
        name: 'Test Token 2',
        prefix: 'mgp_',
        status: 'active' as const,
        usageCount: 5,
        lastUsedAt: now - 7200, // 2 hours ago
        lastUsedIp: '192.168.1.101',
        createdAt: now - 172800, // 2 days ago
      },
      {
        token: 'mgp_revoked_token_3',
        name: 'Revoked Token',
        prefix: 'mgp_',
        status: 'revoked' as const,
        usageCount: 25,
        lastUsedAt: now - 86400, // 1 day ago
        lastUsedIp: '192.168.1.102',
        createdAt: now - 259200, // 3 days ago
        revokedAt: now - 3600, // 1 hour ago
      }
    ]

    for (const token of testTokens) {
      await testDrizzle.insert(apiTokens).values(token)
    }
  })

  describe('GET /', () => {
    it('should require admin authentication', async () => {
      const res = await app.request('/')
      expect(res.status).toBe(401)
    })

    it('should return token list with JWT token', async () => {
      const res = await app.request('/', {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
        },
      })
      
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.tokens).toHaveLength(3)
      
      // Check token structure
      const token = body.data.tokens[0]
      expect(token).toHaveProperty('id')
      expect(token).toHaveProperty('name')
      expect(token).toHaveProperty('prefix')
      expect(token).toHaveProperty('status')
      expect(token).toHaveProperty('usageCount')
      expect(token).toHaveProperty('lastUsedAt')
      expect(token).toHaveProperty('createdAt')
      
      // Token should be masked
      expect(token.token).toMatch(/^mgp_\*+/)
      expect(token.token).not.toContain('active_token')
      
      // Should include pagination info
      expect(body.data).toHaveProperty('pagination')
      expect(body.data.pagination.total).toBe(3)
    })

    it('should filter tokens by status', async () => {
      const res = await app.request('/?status=active', {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
        },
      })
      
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.tokens).toHaveLength(2)
      expect(body.data.tokens.every((token: any) => token.status === 'active')).toBe(true)
    })

    it('should support pagination', async () => {
      const res = await app.request('/?limit=2', {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
        },
      })
      
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.tokens).toHaveLength(2)
      expect(body.data.pagination.limit).toBe(2)
      expect(body.data.pagination.hasNext).toBe(true)
    })
  })

  describe('POST /', () => {
    it('should require admin authentication', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Token',
        }),
      })
      expect(res.status).toBe(401)
    })

    it('should create new token', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Test Token',
        }),
      })
      
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.token).toMatch(/^mgp_[a-f0-9]{64}$/)
      expect(body.data.name).toBe('New Test Token')
      expect(body.data.prefix).toBe('mgp_')
      expect(body.data.status).toBe('active')

      // Verify token was saved to database
      const dbTokens = await testDrizzle.select().from(apiTokens).where(eq(apiTokens.name, 'New Test Token'))
      expect(dbTokens).toHaveLength(1)
      expect(dbTokens[0].token).toBe(body.data.token)
    })

    it('should create token without name', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.token).toMatch(/^mgp_[a-f0-9]{64}$/)
      expect(body.data.name).toBeNull()
    })
  })

  describe('DELETE /:id', () => {
    it('should require admin authentication', async () => {
      const res = await app.request('/1', {
        method: 'DELETE',
      })
      expect(res.status).toBe(401)
    })

    it('should revoke token', async () => {
      // Get a token to revoke
      const tokens = await testDrizzle.select().from(apiTokens).where(eq(apiTokens.status, 'active')).limit(1)
      const tokenId = tokens[0].id

      const res = await app.request(`/${tokenId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
        },
      })
      
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('revoked')

      // Verify token status was updated
      const updatedToken = await testDrizzle.select().from(apiTokens).where(eq(apiTokens.id, tokenId)).limit(1)
      expect(updatedToken[0].status).toBe('revoked')
      expect(updatedToken[0].revokedAt).toBeTruthy()
    })

    it('should return 404 for non-existent token', async () => {
      const res = await app.request('/99999', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
        },
      })
      
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('should not revoke already revoked token', async () => {
      // Get a revoked token
      const tokens = await testDrizzle.select().from(apiTokens).where(eq(apiTokens.status, 'revoked')).limit(1)
      const tokenId = tokens[0].id

      const res = await app.request(`/${tokenId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
        },
      })
      
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.message).toContain('already revoked')
    })
  })
})