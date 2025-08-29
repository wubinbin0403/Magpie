import { Context, Next } from 'hono'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { sendError } from '../utils/response.js'
import { verifyAdminJWT } from '../utils/auth.js'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

export function requireAdmin(database: BetterSQLite3Database<any> = db) {
  return async (c: Context, next: Next) => {
    const authorization = c.req.header('authorization')
    
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return sendError(c, 'AUTH_REQUIRED', 'Admin authentication required', undefined, 401)
    }

    const token = authorization.substring(7)
    
    try {
      // Verify JWT token
      const decoded = verifyAdminJWT(token)
      if (!decoded) {
        return sendError(c, 'INVALID_TOKEN', 'Invalid admin token', undefined, 401)
      }

      // Verify user exists and is active admin
      const userResult = await database
        .select()
        .from(users)
        .where(and(
          eq(users.id, decoded.userId),
          eq(users.role, 'admin'),
          eq(users.status, 'active')
        ))
        .limit(1)

      if (userResult.length === 0) {
        return sendError(c, 'FORBIDDEN', 'Admin access denied', undefined, 403)
      }

      // Check role in token matches expected admin role
      if (decoded.role !== 'admin') {
        return sendError(c, 'FORBIDDEN', 'Admin access denied', undefined, 403)
      }

      // Set admin data in context
      c.set('adminData', {
        id: decoded.userId,
        username: decoded.username,
        role: decoded.role,
        user: userResult[0]
      })

      await next()
    } catch (error) {
      console.error('Admin auth middleware error:', error)
      return sendError(c, 'INTERNAL_SERVER_ERROR', 'Authentication error', undefined, 500)
    }
  }
}