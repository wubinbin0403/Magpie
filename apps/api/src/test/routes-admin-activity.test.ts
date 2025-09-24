import { describe, it, expect, beforeEach } from 'vitest'
import { clearTestData } from './helpers.js'
import { testDrizzle } from './setup.js'
import { apiTokens, operationLogs, users } from '../db/schema.js'
import { createAdminActivityRouter } from '../routes/admin/activity.js'
import { hashPassword, createAdminJWT } from '../utils/auth.js'

describe('Admin Activity API', () => {
  let app: any
  let adminToken: string
  let adminUserId: number
  let tokenId: number

  beforeEach(async () => {
    clearTestData()

    app = createAdminActivityRouter(testDrizzle)

    const { hash, salt } = await hashPassword('admin123')
    const now = Math.floor(Date.now() / 1000)

    const adminResult = await testDrizzle
      .insert(users)
      .values({
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: hash,
        salt,
        role: 'admin',
        status: 'active',
        createdAt: now,
      })
      .returning({ id: users.id })

    adminUserId = adminResult[0].id

    const tokenResult = await testDrizzle
      .insert(apiTokens)
      .values({
        token: 'mgp_test_token',
        name: 'CLI',
        prefix: 'mgp_test',
        status: 'active',
        createdAt: now,
      })
      .returning({ id: apiTokens.id })

    tokenId = tokenResult[0].id

    adminToken = createAdminJWT({
      userId: adminUserId,
      username: 'admin',
      role: 'admin',
    })

    await testDrizzle.insert(operationLogs).values([
      {
        action: 'link_add',
        resource: 'links',
        resourceId: 101,
        details: JSON.stringify({ url: 'https://example.com', source: 'admin' }),
        status: 'success',
        userId: adminUserId,
        ip: '192.168.1.10',
        userAgent: 'Mozilla/5.0',
        duration: 123,
        createdAt: now - 60,
      },
      {
        action: 'token_create',
        resource: 'tokens',
        resourceId: tokenId,
        details: JSON.stringify({ name: 'CLI', prefix: 'mgp_cli' }),
        status: 'success',
        tokenId,
        ip: '192.168.1.20',
        userAgent: 'CLI-Agent/1.0',
        duration: 80,
        createdAt: now - 30,
      },
      {
        action: 'link_delete',
        resource: 'links',
        resourceId: 202,
        details: JSON.stringify({ reason: 'cleanup', isTest: true }),
        status: 'failed',
        userId: adminUserId,
        errorMessage: 'Link not found',
        userAgent: 'Vitest Runner',
        duration: 45,
        createdAt: now - 10,
      },
    ])
  })

  it('requires admin authentication', async () => {
    const response = await app.request('/')
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
    expect(data.error?.code).toBe('AUTH_REQUIRED')
  })

  it('returns paginated activity logs with filter metadata when including test logs', async () => {
    const response = await app.request('/?includeTests=true', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    })

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.data.logs).toHaveLength(3)
    expect(data.data.pagination.total).toBe(3)
    expect(data.data.availableFilters.actions).toContain('link_add')
    expect(data.data.availableFilters.resources).toContain('links')
    expect(data.data.availableFilters.statuses).toContain('success')

    const firstLog = data.data.logs[0]
    expect(firstLog).toHaveProperty('action')
    expect(firstLog).toHaveProperty('createdAt')
  })

  it('excludes test logs by default', async () => {
    const response = await app.request('/', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    })

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.data.logs).toHaveLength(2)
    const actions = data.data.logs.map((log: any) => log.action)
    expect(actions).not.toContain('link_delete')
    expect(data.data.pagination.total).toBe(2)
  })

  it('supports filtering by action and status', async () => {
    const response = await app.request('/?action=link_delete&status=failed&includeTests=true', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    })

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.data.logs).toHaveLength(1)
    expect(data.data.logs[0].action).toBe('link_delete')
    expect(data.data.logs[0].status).toBe('failed')
  })
})
