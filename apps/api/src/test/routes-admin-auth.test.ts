import { describe, it, expect, beforeEach } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { users } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { createAdminAuthRouter } from '../routes/admin/auth.js'
import { hashPassword } from '../utils/auth.js'

describe('Admin Auth API', () => {
  let app: any

  beforeEach(async () => {
    clearTestData()
    
    // Use real router with test database injection
    app = createAdminAuthRouter(testDrizzle)
  })

  describe('POST /login', () => {
    it('should login with valid password', async () => {
      // Create admin user
      const password = 'admin123'
      const { hash, salt } = await hashPassword(password)
      const now = Math.floor(Date.now() / 1000)
      
      await testDrizzle
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

      const response = await app.request('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: password
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.token).toBeDefined()
      expect(data.data.expiresAt).toBeDefined()
      expect(data.data.user.role).toBe('admin')
      expect(data.data.user.permissions).toEqual(['admin'])
    })

    it('should reject invalid password', async () => {
      // Create admin user
      const password = 'admin123'
      const { hash, salt } = await hashPassword(password)
      const now = Math.floor(Date.now() / 1000)
      
      await testDrizzle
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

      const response = await app.request('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: 'wrongpassword'
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('should reject login when no admin exists', async () => {
      const response = await app.request('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: 'anypassword'
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should reject login for suspended admin', async () => {
      // Create suspended admin user
      const password = 'admin123'
      const { hash, salt } = await hashPassword(password)
      const now = Math.floor(Date.now() / 1000)
      
      await testDrizzle
        .insert(users)
        .values({
          username: 'admin',
          email: 'admin@example.com',
          passwordHash: hash,
          salt: salt,
          role: 'admin',
          status: 'suspended',
          createdAt: now,
        })

      const response = await app.request('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: password
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('FORBIDDEN')
    })

    it('should update last login info', async () => {
      // Create admin user
      const password = 'admin123'
      const { hash, salt } = await hashPassword(password)
      const now = Math.floor(Date.now() / 1000)
      
      const userResult = await testDrizzle
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

      const userId = userResult[0].id

      const response = await app.request('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '192.168.1.1'
        },
        body: JSON.stringify({
          password: password
        })
      })

      expect(response.status).toBe(200)

      // Check that last login info is updated
      const updatedUser = await testDrizzle
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      expect(updatedUser[0].lastLoginAt).toBeGreaterThanOrEqual(now)
      expect(updatedUser[0].lastLoginIp).toBe('192.168.1.1')
    })

    it('should validate request data', async () => {
      const response = await app.request('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Missing password
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  describe('POST /init', () => {
    it('should initialize admin when no admin exists', async () => {
      const response = await app.request('/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: 'newadmin123'
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('initialized')

      // Verify admin user was created
      const adminUsers = await testDrizzle
        .select()
        .from(users)
        .where(eq(users.role, 'admin'))

      expect(adminUsers).toHaveLength(1)
      expect(adminUsers[0].username).toBe('admin')
      expect(adminUsers[0].status).toBe('active')
    })

    it('should reject initialization when admin already exists', async () => {
      // Create existing admin
      const password = 'admin123'
      const { hash, salt } = await hashPassword(password)
      const now = Math.floor(Date.now() / 1000)
      
      await testDrizzle
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

      const response = await app.request('/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: 'newadmin123'
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(409)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('CONFLICT')
    })

    it('should validate password requirements', async () => {
      const response = await app.request('/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: '123' // Too short
        })
      })
      const data = await response.json() as any

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })
})