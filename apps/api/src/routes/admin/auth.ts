import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { db } from '../../db/index.js'
import { users } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { sendSuccess, sendError, notFound } from '../../utils/response.js'
import { adminLoginSchema, adminInitSchema } from '../../utils/validation.js'
import { hashPassword, verifyPassword, createAdminJWT, getClientIp } from '../../utils/auth.js'
import { requireAdmin } from '../../middleware/admin.js'
import type { AdminLoginResponse } from '@magpie/shared'
import { adminLogger } from '../../utils/logger.js'

// Create admin auth router with optional database dependency injection
function createAdminAuthRouter(database = db) {
  const app = new Hono()

  // Error handling middleware
  app.onError((err, c) => {
    adminLogger.error('Admin Auth API error', {
      error: err instanceof Error ? err.message : err,
      stack: err instanceof Error ? err.stack : undefined
    })
    
    if (err instanceof Error && (err.message.includes('ZodError') || err.name === 'ZodError')) {
      return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
    }
    
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred', undefined, 500)
  })

  // POST /api/admin/login - Admin login
  app.post('/login', zValidator('json', adminLoginSchema), async (c) => {
    try {
      const { password } = c.req.valid('json')
      const clientIp = getClientIp(c.req.raw)

      // Find admin user (regardless of status)
      const adminResult = await database
        .select()
        .from(users)
        .where(eq(users.role, 'admin'))
        .limit(1)

      if (adminResult.length === 0) {
        return notFound(c, 'No admin account found')
      }

      const admin = adminResult[0]

      // Verify password first
      const isValidPassword = await verifyPassword(password, admin.passwordHash)
      if (!isValidPassword) {
        return sendError(c, 'UNAUTHORIZED', 'Invalid password', undefined, 401)
      }

      // Check account status after password verification
      if (admin.status !== 'active') {
        return sendError(c, 'FORBIDDEN', 'Account is suspended', undefined, 403)
      }

      // Update last login info
      const now = Math.floor(Date.now() / 1000)
      await database
        .update(users)
        .set({
          lastLoginAt: now,
          lastLoginIp: clientIp,
        })
        .where(eq(users.id, admin.id))

      // Create JWT token
      const token = createAdminJWT({
        userId: admin.id,
        username: admin.username,
        role: admin.role
      })

      // Calculate expiry (24 hours from now)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      const responseData: AdminLoginResponse = {
        token,
        expiresAt,
        user: {
          role: 'admin',
          permissions: ['admin']
        }
      }

      return sendSuccess(c, responseData)

    } catch (error) {
      adminLogger.error('Error during admin login', {
        ip: getClientIp(c.req.raw),
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
      return sendError(c, 'INTERNAL_SERVER_ERROR', 'Login failed', undefined, 500)
    }
  })

  // POST /api/admin/logout - Admin logout
  app.post('/logout', async (c) => {
    try {
      // Get the authorization header
      const authHeader = c.req.header('Authorization')
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return sendSuccess(c, { loggedOut: true }, 'Already logged out')
      }

      const token = authHeader.substring(7)
      
      // In a production system, you might want to:
      // 1. Add the token to a blacklist
      // 2. Clear any server-side session data
      // 3. Log the logout event
      
      // For now, we'll just verify it's a valid token format
      if (token.startsWith('session_') || token.length > 20) {
        // Optional: Clear session from database if storing sessions
        // This implementation assumes client-side token management
        
        return sendSuccess(c, { 
          loggedOut: true,
          message: 'Logged out successfully'
        }, 'Logout successful')
      }
      
      return sendSuccess(c, { loggedOut: true }, 'Logout successful')
      
    } catch (error) {
      adminLogger.error('Error during admin logout', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
      // Even if there's an error, we return success for logout
      return sendSuccess(c, { loggedOut: true }, 'Logout successful')
    }
  })

  // GET /api/admin/check - Check if admin account exists (public endpoint)
  app.get('/check', async (c) => {
    try {
      const existingAdmin = await database
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'admin'))
        .limit(1)

      return sendSuccess(c, { 
        exists: existingAdmin.length > 0 
      })
    } catch (error) {
      adminLogger.error('Error checking admin existence', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
      return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to check admin status', undefined, 500)
    }
  })

  // GET /api/admin/verify - Verify admin token (protected endpoint)
  app.get('/verify', requireAdmin(database), async (c) => {
    try {
      const adminData = (c as any).get('adminData') as {
        id: number;
        username: string;
        role: string;
        user: any;
      }
      
      return sendSuccess(c, {
        valid: true,
        user: {
          id: adminData.id,
          username: adminData.username,
          role: adminData.role
        }
      })
    } catch (error) {
      adminLogger.error('Error verifying admin token', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
      return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to verify token', undefined, 500)
    }
  })

  // POST /api/admin/init - Initialize admin account
  app.post('/init', zValidator('json', adminInitSchema), async (c) => {
    try {
      const { password } = c.req.valid('json')

      // Check if admin already exists
      const existingAdmin = await database
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'admin'))
        .limit(1)

      if (existingAdmin.length > 0) {
        return sendError(c, 'CONFLICT', 'Admin account already exists', undefined, 409)
      }

      // Create admin user
      const now = Math.floor(Date.now() / 1000)
      const { hash, salt } = await hashPassword(password)

      await database
        .insert(users)
        .values({
          username: 'admin',
          email: 'admin@example.com', // Default email
          displayName: 'Administrator',
          passwordHash: hash,
          salt: salt,
          role: 'admin',
          status: 'active',
          createdAt: now,
          updatedAt: now,
        })

      return sendSuccess(c, {}, 'Admin account initialized successfully')

    } catch (error) {
      adminLogger.error('Error during admin initialization', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
      return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to initialize admin account', undefined, 500)
    }
  })

  return app
}

// Export both the router factory and a default instance
export { createAdminAuthRouter }
export default createAdminAuthRouter()
