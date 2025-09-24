import { Hono } from 'hono'
import { db } from '../../db/index.js'
import { verifyApiToken } from '../../middleware/auth.js'
import { sendSuccess, sendError } from '../../utils/response.js'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { apiLogger } from '../../utils/logger.js'

// Create verify token router with optional database dependency injection
function createVerifyTokenRouter(database: BetterSQLite3Database<any> = db) {
  const app = new Hono()

  // POST /api/auth/verify - Verify API token validity
  app.post('/verify', async (c) => {
    try {
      // Get Authorization header
      const authHeader = c.req.header('Authorization')
      
      if (!authHeader) {
        return sendError(c, 'Missing Authorization header', '401')
      }

      // Extract token from Bearer format
      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader

      // Get client IP for logging
      const clientIp = c.req.header('x-forwarded-for') || 
                      c.req.header('x-real-ip') || 
                      (c.env as any)?.ip || 
                      'unknown'

      // Verify the token
      const verification = await verifyApiToken(token, clientIp, database)

      if (!verification.valid) {
        const errorMessages: Record<string, string> = {
          'INVALID_FORMAT': 'Invalid token format',
          'INVALID_TOKEN': 'Invalid or expired token',
          'TOKEN_REVOKED': 'Token has been revoked'
        }
        
        const message = errorMessages[verification.error || 'INVALID_TOKEN']
        return sendError(c, message, '401')
      }

      // Return success with token info
      return sendSuccess(c, {
        valid: true,
        token: {
          name: verification.tokenData!.name,
          createdAt: verification.tokenData!.createdAt,
          lastUsedAt: verification.tokenData!.lastUsedAt,
          usageCount: verification.tokenData!.usageCount
        }
      }, 'Token is valid')
      
    } catch (error) {
      apiLogger.error('Token verification error', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
      return sendError(c, 'Failed to verify token', '500')
    }
  })

  // GET /api/auth/verify - Simple health check for connection testing
  app.get('/verify', async (c) => {
    return sendSuccess(c, {
      connected: true,
      serverTime: new Date().toISOString()
    }, 'Server is reachable')
  })

  return app
}

// Export both the router factory and a default instance
export { createVerifyTokenRouter }
export default createVerifyTokenRouter()
