// Hono Context type extensions for type-safe access to middleware-set values

import type { Context } from 'hono'

// Extend Hono's Context interface to provide type-safe access to middleware values
declare module 'hono' {
  interface ContextVariableMap {
    // Authentication related
    tokenData: { id: number } | undefined
    userData: { id: number; username?: string; role?: string } | undefined
    authType: 'api_token' | 'admin_session' | 'admin_jwt' | undefined
    
    // Request metadata
    clientIp: string
    userAgent: string | undefined
    
    // Rate limiting
    rateLimitData: {
      remaining: number
      reset: number
      limit: number
    } | undefined
  }
}

// Helper functions for type-safe context access
export function getTokenData(c: Context): { id: number } | undefined {
  return c.get('tokenData')
}

export function getUserData(c: Context): { id: number; username?: string } | undefined {
  return c.get('userData')
}

export function getAuthType(c: Context): 'api_token' | 'admin_session' | 'admin_jwt' | undefined {
  return c.get('authType')
}

export function getClientIp(c: Context): string {
  return c.get('clientIp') || 'unknown'
}

export function getUserAgent(c: Context): string | undefined {
  return c.get('userAgent')
}

export function getRateLimitData(c: Context) {
  return c.get('rateLimitData')
}

// Type guard functions
export function hasTokenAuth(c: Context): c is Context & { get(key: 'tokenData'): { id: number } } {
  const tokenData = c.get('tokenData')
  return tokenData != null && typeof tokenData.id === 'number'
}

export function hasUserAuth(c: Context): c is Context & { get(key: 'userData'): { id: number; username?: string } } {
  const userData = c.get('userData')
  return userData != null && typeof userData.id === 'number'
}

// Auth data extraction helper (unified for all auth types)
export interface AuthData {
  userId?: number
  tokenId?: number
  clientIp: string
  authType: 'api_token' | 'admin_session' | 'admin_jwt'
  userAgent?: string
}

export function getUnifiedAuthData(c: Context): AuthData | null {
  const authType = getAuthType(c)
  const tokenData = getTokenData(c)
  const userData = getUserData(c)
  const clientIp = getClientIp(c)
  const userAgent = getUserAgent(c)

  if (authType === 'api_token' && tokenData) {
    return {
      tokenId: tokenData.id,
      clientIp,
      authType,
      userAgent
    }
  } else if ((authType === 'admin_session' || authType === 'admin_jwt') && userData) {
    return {
      userId: userData.id,
      clientIp,
      authType,
      userAgent
    }
  }

  return null
}