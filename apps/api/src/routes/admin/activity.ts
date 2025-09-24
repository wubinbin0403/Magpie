import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/index.js'
import { apiTokens, operationLogs, users } from '../../db/schema.js'
import { requireAdmin } from '../../middleware/admin.js'
import { adminActivityQuerySchema } from '../../utils/validation.js'
import { sendError, sendSuccess } from '../../utils/response.js'
import { adminLogger } from '../../utils/logger.js'
import { and, count, desc, eq, gte, like, lte, or, sql } from 'drizzle-orm'
import type { AdminActivityResponse, OperationStatus } from '@magpie/shared'

export function createAdminActivityRouter(database = db) {
  const app = new Hono()

  app.onError((err, c) => {
    adminLogger.error('Admin activity route error', {
      error: err instanceof Error ? err.message : err,
      stack: err instanceof Error ? err.stack : undefined
    })
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to load activity logs')
  })

  app.get('/', requireAdmin(database), zValidator('query', adminActivityQuerySchema), async (c) => {
    try {
      const { page, limit, action, resource, status, search, tokenId, userId, start, end, includeTests: includeTestsRaw } = c.req.valid('query')

      const includeTests = includeTestsRaw ?? false

      const offset = (page - 1) * limit
      const whereConditions: any[] = []

      if (action) {
        whereConditions.push(eq(operationLogs.action, action))
      }

      if (resource) {
        whereConditions.push(eq(operationLogs.resource, resource))
      }

      if (status) {
        whereConditions.push(eq(operationLogs.status, status))
      }

      if (tokenId) {
        whereConditions.push(eq(operationLogs.tokenId, tokenId))
      }

      if (userId) {
        whereConditions.push(eq(operationLogs.userId, userId))
      }

      if (start) {
        const startTimestamp = Math.floor(new Date(start).getTime() / 1000)
        if (!Number.isNaN(startTimestamp)) {
          whereConditions.push(gte(operationLogs.createdAt, startTimestamp))
        }
      }

      if (end) {
        const endTimestamp = Math.floor(new Date(end).getTime() / 1000)
        if (!Number.isNaN(endTimestamp)) {
          whereConditions.push(lte(operationLogs.createdAt, endTimestamp))
        }
      }

      if (search) {
        const term = `%${search}%`
        whereConditions.push(or(
          like(operationLogs.action, term),
          like(operationLogs.resource, term),
          like(operationLogs.details, term),
          like(operationLogs.errorMessage, term),
          like(operationLogs.ip, term),
          like(operationLogs.userAgent, term)
        ))
      }

      if (!includeTests) {
        whereConditions.push(sql`
          (${operationLogs.userAgent} IS NULL OR (
            lower(${operationLogs.userAgent}) NOT LIKE '%vitest%' AND
            lower(${operationLogs.userAgent}) NOT LIKE '%playwright%' AND
            lower(${operationLogs.userAgent}) NOT LIKE '%jest%' AND
            lower(${operationLogs.userAgent}) NOT LIKE '%cypress%' AND
            lower(${operationLogs.userAgent}) NOT LIKE '%mocha%'
          ))
        `)

        whereConditions.push(sql`
          (${operationLogs.details} IS NULL OR (
            ${operationLogs.details} NOT LIKE '%"isTest":true%' AND
            ${operationLogs.details} NOT LIKE '%"source":"test"%' AND
            ${operationLogs.details} NOT LIKE '%"test":true%'
          ))
        `)
      }

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined

      const totalResult = whereClause
        ? await database.select({ count: count() }).from(operationLogs).where(whereClause)
        : await database.select({ count: count() }).from(operationLogs)

      const total = totalResult[0]?.count ?? 0
      const totalPages = Math.ceil(total / limit)

      const baseQuery = database
        .select({
          id: operationLogs.id,
          action: operationLogs.action,
          resource: operationLogs.resource,
          resourceId: operationLogs.resourceId,
          status: operationLogs.status,
          details: operationLogs.details,
          errorMessage: operationLogs.errorMessage,
          ip: operationLogs.ip,
          userAgent: operationLogs.userAgent,
          tokenId: operationLogs.tokenId,
          userId: operationLogs.userId,
          duration: operationLogs.duration,
          createdAt: operationLogs.createdAt,
          tokenName: apiTokens.name,
          tokenPrefix: apiTokens.prefix,
          tokenStatus: apiTokens.status,
          userUsername: users.username,
          userDisplayName: users.displayName,
        })
        .from(operationLogs)
        .leftJoin(apiTokens, eq(operationLogs.tokenId, apiTokens.id))
        .leftJoin(users, eq(operationLogs.userId, users.id))

      const logsQuery = whereClause ? baseQuery.where(whereClause) : baseQuery

      const logsResult = await logsQuery
        .orderBy(desc(operationLogs.createdAt))
        .limit(limit)
        .offset(offset)

      const logs: AdminActivityResponse['logs'] = logsResult.map((item) => {
        let parsedDetails: Record<string, unknown> | null = null
        if (item.details) {
          try {
            parsedDetails = JSON.parse(item.details)
          } catch (error) {
            adminLogger.warn('Failed to parse operation log details JSON', {
              logId: item.id,
              error: error instanceof Error ? error.message : error,
              rawDetails: item.details
            })
          }
        }

        let actor: AdminActivityResponse['logs'][number]['actor'] = null
        if (item.userId) {
          actor = {
            type: 'user',
            id: item.userId,
            name: item.userDisplayName ?? item.userUsername ?? null,
            identifier: item.userUsername ?? null
          }
        } else if (item.tokenId) {
          actor = {
            type: 'token',
            id: item.tokenId,
            name: item.tokenName ?? null,
            identifier: item.tokenPrefix ?? null
          }
        }

        return {
          id: item.id,
          action: item.action,
          resource: item.resource,
          resourceId: item.resourceId,
          status: item.status as OperationStatus,
          details: parsedDetails,
          errorMessage: item.errorMessage,
          ip: item.ip,
          userAgent: item.userAgent,
          duration: item.duration,
          actor,
          createdAt: new Date((item.createdAt || 0) * 1000).toISOString()
        }
      })

      const actionRows = await database
        .select({ action: operationLogs.action })
        .from(operationLogs)
        .groupBy(operationLogs.action)

      const resourceRows = await database
        .select({ resource: operationLogs.resource })
        .from(operationLogs)
        .groupBy(operationLogs.resource)

      const statusRows = await database
        .select({ status: operationLogs.status })
        .from(operationLogs)
        .groupBy(operationLogs.status)

      const statusOrder: OperationStatus[] = ['success', 'pending', 'failed']

      const availableFilters: AdminActivityResponse['availableFilters'] = {
        actions: Array.from(new Set(actionRows
          .map(row => row.action)
          .filter((value): value is string => Boolean(value)))).sort(),
        resources: Array.from(new Set(resourceRows
          .map(row => row.resource)
          .filter((value): value is string => Boolean(value)))).sort(),
        statuses: Array.from(new Set(statusRows
          .map(row => row.status as OperationStatus)))
          .sort((a, b) => {
            const indexA = statusOrder.indexOf(a)
            const indexB = statusOrder.indexOf(b)
            const resolvedA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA
            const resolvedB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB
            return resolvedA - resolvedB
          })
      }

      return sendSuccess<AdminActivityResponse>(c, {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        availableFilters
      })
    } catch (error) {
      adminLogger.error('Failed to fetch admin activity logs', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
      return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to load activity logs')
    }
  })

  return app
}

const adminActivityRouter = createAdminActivityRouter()
export default adminActivityRouter
