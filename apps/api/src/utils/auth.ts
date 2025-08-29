import * as bcrypt from 'bcrypt'
import * as jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production'
const JWT_EXPIRY = '24h' // 24 hours

// Password hashing utilities
export async function hashPassword(password: string): Promise<{ hash: string, salt: string }> {
  // Use fewer rounds in test environment for faster tests
  const saltRounds = process.env.NODE_ENV === 'test' ? 4 : 12
  const salt = await bcrypt.genSalt(saltRounds)
  const hash = await bcrypt.hash(password, salt)
  return { hash, salt }
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// JWT utilities
export function createAdminJWT(payload: { userId: number, username: string, role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY })
}

export function verifyAdminJWT(token: string): { userId: number, username: string, role: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    
    if (typeof decoded.userId === 'number' && 
        typeof decoded.username === 'string' && 
        typeof decoded.role === 'string') {
      return {
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role
      }
    }
    
    return null
  } catch (error) {
    return null
  }
}

// Extract client IP from request
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  
  // Fallback for development/testing
  return '127.0.0.1'
}