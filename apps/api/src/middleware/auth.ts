import { Context, Next } from 'hono';
import { db } from '../db/index.js';
import { apiTokens, users, operationLogs } from '../db/schema.js';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import type { ApiToken, User } from '../db/schema.js';
import { verifyAdminJWT } from '../utils/auth.js';

// Auth verification result types
export interface ApiTokenVerification {
  valid: boolean;
  tokenData?: ApiToken;
  error?: 'INVALID_FORMAT' | 'INVALID_TOKEN' | 'TOKEN_REVOKED';
}

export interface SessionTokenVerification {
  valid: boolean;
  userData?: User;
  error?: 'INVALID_FORMAT' | 'INVALID_TOKEN' | 'SESSION_EXPIRED' | 'USER_SUSPENDED';
}

// Session duration: 7 days
const SESSION_DURATION = 7 * 24 * 60 * 60; // seconds

/**
 * Verify API Token (mgp_xxxx format)
 */
export async function verifyApiToken(
  token: string, 
  clientIp?: string, 
  database: BetterSQLite3Database<any> = db
): Promise<ApiTokenVerification> {
  // Format validation
  if (!token || !token.startsWith('mgp_') || token.length !== 68) {
    return { valid: false, error: 'INVALID_FORMAT' };
  }
  
  const hexPart = token.slice(4);
  if (!/^[a-f0-9]{64}$/.test(hexPart)) {
    return { valid: false, error: 'INVALID_FORMAT' };
  }

  try {
    // Database lookup
    const tokenData = await database
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.token, token))
      .limit(1);

    if (tokenData.length === 0) {
      return { valid: false, error: 'INVALID_TOKEN' };
    }

    const tokenRecord = tokenData[0];

    // Check if token is revoked
    if (tokenRecord.status === 'revoked') {
      return { valid: false, error: 'TOKEN_REVOKED' };
    }

    // Update usage statistics
    const now = Math.floor(Date.now() / 1000);
    await database
      .update(apiTokens)
      .set({
        usageCount: tokenRecord.usageCount + 1,
        lastUsedAt: now,
        lastUsedIp: clientIp || null,
      })
      .where(eq(apiTokens.id, tokenRecord.id));

    return { valid: true, tokenData: tokenRecord };
    
  } catch (error) {
    console.error('API token verification error:', error);
    return { valid: false, error: 'INVALID_TOKEN' };
  }
}

/**
 * Verify Session Token (session_xxxx format)
 */
export async function verifySessionToken(
  token: string, 
  database: BetterSQLite3Database<any> = db
): Promise<SessionTokenVerification> {
  // Format validation
  if (!token || !token.startsWith('session_') || token.length !== 72) {
    return { valid: false, error: 'INVALID_FORMAT' };
  }
  
  const hexPart = token.slice(8);
  if (!/^[a-f0-9]{64}$/.test(hexPart)) {
    return { valid: false, error: 'INVALID_FORMAT' };
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    
    // Database lookup - don't filter by status here, we want to check status explicitly
    const userData = await database
      .select()
      .from(users)
      .where(eq(users.sessionToken, token))
      .limit(1);

    if (userData.length === 0) {
      return { valid: false, error: 'INVALID_TOKEN' };
    }

    const userRecord = userData[0];

    // Check if session is expired
    if (!userRecord.sessionExpiresAt || userRecord.sessionExpiresAt <= now) {
      return { valid: false, error: 'SESSION_EXPIRED' };
    }

    // Check if user is suspended or not active
    if (userRecord.status === 'suspended') {
      return { valid: false, error: 'USER_SUSPENDED' };
    }
    
    if (userRecord.status !== 'active') {
      return { valid: false, error: 'USER_SUSPENDED' };
    }

    return { valid: true, userData: userRecord };
    
  } catch (error) {
    console.error('Session token verification error:', error);
    return { valid: false, error: 'INVALID_TOKEN' };
  }
}

/**
 * Create new session token for user
 */
export async function createSessionToken(
  userId: number, 
  clientIp?: string, 
  database: BetterSQLite3Database<any> = db
): Promise<string> {
  const sessionToken = 'session_' + crypto.randomBytes(32).toString('hex');
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_DURATION;

  // Update user record with new session
  await database
    .update(users)
    .set({
      sessionToken,
      sessionExpiresAt: expiresAt,
      lastLoginAt: now,
      lastLoginIp: clientIp || null,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  return sessionToken;
}

/**
 * Revoke session token for user
 */
export async function revokeSessionToken(userId: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  
  await db
    .update(users)
    .set({
      sessionToken: null,
      sessionExpiresAt: null,
      updatedAt: now,
    })
    .where(eq(users.id, userId));
}

/**
 * Hono middleware for API token authentication
 */
export function requireApiToken(database: BetterSQLite3Database<any> = db) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        success: false,
        error: 'AUTH_REQUIRED',
        message: 'Authorization header with Bearer token required'
      }, 401);
    }

    const token = authHeader.slice(7); // Remove 'Bearer '
    const clientIp = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    
    const verification = await verifyApiToken(token, clientIp, database);
    
    if (!verification.valid) {
      const errorMessages = {
        INVALID_FORMAT: 'Invalid token format',
        INVALID_TOKEN: 'Invalid or expired token',
        TOKEN_REVOKED: 'Token has been revoked'
      };
      
      return c.json({
        success: false,
        error: 'AUTH_INVALID',
        message: errorMessages[verification.error!]
      }, 401);
    }

    // Add token data to context
    c.set('tokenData', verification.tokenData);
    c.set('clientIp', clientIp);
    
    await next();
  };
}

/**
 * Hono middleware for session token authentication
 */
export function requireSessionToken() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        success: false,
        error: 'AUTH_REQUIRED',
        message: 'Authorization header with Bearer session token required'
      }, 401);
    }

    const token = authHeader.slice(7); // Remove 'Bearer '
    
    const verification = await verifySessionToken(token);
    
    if (!verification.valid) {
      const errorMessages = {
        INVALID_FORMAT: 'Invalid session token format',
        INVALID_TOKEN: 'Invalid session token',
        SESSION_EXPIRED: 'Session has expired',
        USER_SUSPENDED: 'User account is suspended'
      };
      
      return c.json({
        success: false,
        error: 'AUTH_INVALID',
        message: errorMessages[verification.error!]
      }, 401);
    }

    // Add user data to context
    c.set('userData', verification.userData);
    
    await next();
  };
}

/**
 * Hono middleware for dual authentication (API token OR admin JWT OR admin session)
 * Tries API token first, then JWT token, then session token
 */
export function requireApiTokenOrAdminSession(database: BetterSQLite3Database<any> = db) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        success: false,
        error: 'AUTH_REQUIRED',
        message: 'Authorization header with Bearer token required'
      }, 401);
    }

    const token = authHeader.slice(7); // Remove 'Bearer '
    const clientIp = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    
    // First try API token verification (mgp_xxxx format)
    if (token.startsWith('mgp_')) {
      const verification = await verifyApiToken(token, clientIp, database);
      
      if (verification.valid) {
        // API token is valid
        c.set('tokenData', verification.tokenData);
        c.set('clientIp', clientIp);
        c.set('authType', 'api_token');
        await next();
        return;
      }
    }
    
    // Try session token (session_xxxx format)
    else if (token.startsWith('session_')) {
      const verification = await verifySessionToken(token, database);
      
      if (verification.valid) {
        // Session token is valid - check if user is admin
        if (verification.userData?.role !== 'admin') {
          return c.json({
            success: false,
            error: 'FORBIDDEN',
            message: 'Admin access required'
          }, 403);
        }
        
        // Admin session is valid
        c.set('userData', verification.userData);
        c.set('clientIp', clientIp);
        c.set('authType', 'admin_session');
        await next();
        return;
      }
    }
    
    // Try JWT token (for admin users)
    else {
      const jwtPayload = verifyAdminJWT(token);
      
      if (jwtPayload && jwtPayload.role === 'admin') {
        // JWT is valid and user is admin
        c.set('userData', {
          id: jwtPayload.userId,
          username: jwtPayload.username,
          role: jwtPayload.role
        });
        c.set('clientIp', clientIp);
        c.set('authType', 'admin_jwt');
        await next();
        return;
      }
    }
    
    // All authentication methods failed
    return c.json({
      success: false,
      error: 'AUTH_INVALID',
      message: 'Invalid or expired token'
    }, 401);
  };
}

/**
 * Log API operation for audit trail
 */
export async function logOperation(
  action: string,
  resource?: string,
  resourceId?: number,
  details?: any,
  tokenId?: number,
  userId?: number,
  clientIp?: string,
  userAgent?: string,
  status: 'success' | 'failed' | 'pending' = 'success',
  errorMessage?: string,
  duration?: number
) {
  try {
    await db.insert(operationLogs).values({
      action,
      resource,
      resourceId,
      details: details ? JSON.stringify(details) : null,
      status,
      errorMessage,
      userAgent,
      ip: clientIp,
      tokenId,
      userId,
      duration,
      createdAt: Math.floor(Date.now() / 1000),
    });
  } catch (error) {
    console.error('Failed to log operation:', error);
    // Don't throw - logging failure shouldn't break the main operation
  }
}