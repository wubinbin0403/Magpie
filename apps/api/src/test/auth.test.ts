import { describe, it, expect, beforeEach } from 'vitest';
import { testDrizzle } from './setup.js';
import { seedTestDatabase, clearTestData } from './helpers.js';
import { apiTokens, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { verifyApiToken, verifySessionToken, createSessionToken } from '../middleware/auth.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

describe('Authentication Middleware', () => {
  beforeEach(() => {
    clearTestData();
  });

  describe('API Token Authentication', () => {
    it('should verify valid API token', async () => {
      // Seed database with initial token
      const result = await seedTestDatabase();
      expect(result?.tokenValue).toBeTruthy();
      
      // Test the middleware
      const verification = await verifyApiToken(result!.tokenValue, undefined, testDrizzle);
      
      expect(verification.valid).toBe(true);
      expect(verification.tokenData).toBeTruthy();
      expect(verification.tokenData?.token).toBe(result!.tokenValue);
      expect(verification.tokenData?.status).toBe('active');
    });

    it('should reject invalid API token', async () => {
      await seedTestDatabase();
      
      const invalidToken = 'mgp_' + 'a'.repeat(64); // Valid format but doesn't exist in DB
      const verification = await verifyApiToken(invalidToken, undefined, testDrizzle);
      
      expect(verification.valid).toBe(false);
      expect(verification.error).toBe('INVALID_TOKEN');
    });

    it('should reject revoked API token', async () => {
      const result = await seedTestDatabase();
      const tokenValue = result!.tokenValue;
      
      // Revoke the token
      await testDrizzle
        .update(apiTokens)
        .set({ 
          status: 'revoked',
          revokedAt: Math.floor(Date.now() / 1000)
        })
        .where(eq(apiTokens.token, tokenValue));
      
      const verification = await verifyApiToken(tokenValue, undefined, testDrizzle);
      
      expect(verification.valid).toBe(false);
      expect(verification.error).toBe('TOKEN_REVOKED');
    });

    it('should reject malformed API token', async () => {
      await seedTestDatabase();
      
      const malformedTokens = [
        'invalid-token',
        'mgp_',
        'mgp_short',
        'notmgp_1234567890abcdef',
        '',
        'mgp_' + 'x'.repeat(63), // 63 chars instead of 64
      ];
      
      for (const token of malformedTokens) {
        const verification = await verifyApiToken(token, undefined, testDrizzle);
        expect(verification.valid).toBe(false);
        expect(verification.error).toBe('INVALID_FORMAT');
      }
    });

    it('should update token usage statistics', async () => {
      const result = await seedTestDatabase();
      const tokenValue = result!.tokenValue;
      const testIp = '127.0.0.1';
      
      // Verify token with IP tracking  
      const verification = await verifyApiToken(tokenValue, testIp, testDrizzle);
      expect(verification.valid).toBe(true);
      
      // Check that usage stats were updated
      const tokenData = await testDrizzle
        .select()
        .from(apiTokens)
        .where(eq(apiTokens.token, tokenValue))
        .limit(1);
      
      expect(tokenData).toHaveLength(1);
      expect(tokenData[0].usageCount).toBe(1);
      expect(tokenData[0].lastUsedAt).toBeTruthy();
      expect(tokenData[0].lastUsedIp).toBe(testIp);
    });
  });

  describe('Session Token Authentication', () => {
    it('should create and verify session token', async () => {
      await seedTestDatabase();
      
      // Create a test admin user
      const password = 'test-admin-password';
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      
      const [userId] = await testDrizzle.insert(users).values({
        username: 'admin',
        passwordHash,
        salt,
        createdAt: Math.floor(Date.now() / 1000),
      }).returning({ id: users.id });
      
      // Create session token
      const sessionToken = await createSessionToken(userId.id, undefined, testDrizzle);
      expect(sessionToken).toMatch(/^session_[a-f0-9]{64}$/);
      
      // Verify session token
      const verification = await verifySessionToken(sessionToken, testDrizzle);
      expect(verification.valid).toBe(true);
      expect(verification.userData).toBeTruthy();
      expect(verification.userData?.id).toBe(userId.id);
      expect(verification.userData?.username).toBe('admin');
    });

    it('should reject expired session token', async () => {
      await seedTestDatabase();
      
      // Create expired user session
      const expiredTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const sessionToken = 'session_' + crypto.randomBytes(32).toString('hex');
      
      await testDrizzle.insert(users).values({
        username: 'admin',
        passwordHash: 'hash',
        salt: 'salt',
        sessionToken,
        sessionExpiresAt: expiredTime,
        createdAt: Math.floor(Date.now() / 1000),
      });
      
      const verification = await verifySessionToken(sessionToken, testDrizzle);
      expect(verification.valid).toBe(false);
      expect(verification.error).toBe('SESSION_EXPIRED');
    });

    it('should reject invalid session token', async () => {
      await seedTestDatabase();
      
      const invalidTokens = [
        'invalid-session',
        'session_',
        'session_short',
        'notsession_1234567890abcdef',
        '',
        'session_' + 'x'.repeat(63),
      ];
      
      for (const token of invalidTokens) {
        const verification = await verifySessionToken(token, testDrizzle);
        expect(verification.valid).toBe(false);
        expect(verification.error).toBe('INVALID_FORMAT');
      }
    });

    it('should reject suspended user session', async () => {
      await seedTestDatabase();
      
      const sessionToken = 'session_' + crypto.randomBytes(32).toString('hex');
      const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      
      await testDrizzle.insert(users).values({
        username: 'suspended-admin',
        passwordHash: 'hash',
        salt: 'salt',
        status: 'suspended',
        sessionToken,
        sessionExpiresAt: expiresAt,
        createdAt: Math.floor(Date.now() / 1000),
      });
      
      const verification = await verifySessionToken(sessionToken, testDrizzle);
      expect(verification.valid).toBe(false);
      expect(verification.error).toBe('USER_SUSPENDED');
    });

    it('should update user login statistics', async () => {
      await seedTestDatabase();
      
      const password = 'test-password';
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const testIp = '192.168.1.1';
      
      const [userId] = await testDrizzle.insert(users).values({
        username: 'test-admin',
        passwordHash,
        salt,
        createdAt: Math.floor(Date.now() / 1000),
      }).returning({ id: users.id });
      
      const sessionToken = await createSessionToken(userId.id, testIp, testDrizzle);
      
      // Check that login stats were updated
      const userData = await testDrizzle
        .select()
        .from(users)
        .where(eq(users.id, userId.id))
        .limit(1);
      
      expect(userData).toHaveLength(1);
      expect(userData[0].lastLoginAt).toBeTruthy();
      expect(userData[0].lastLoginIp).toBe(testIp);
      expect(userData[0].sessionToken).toBe(sessionToken);
      expect(userData[0].sessionExpiresAt).toBeTruthy();
    });
  });

  describe('Token Format Validation', () => {
    it('should validate API token format', async () => {
      const validTokens = [
        'mgp_' + 'a'.repeat(64),
        'mgp_' + '1'.repeat(64),
        'mgp_' + crypto.randomBytes(32).toString('hex'),
      ];
      
      for (const token of validTokens) {
        const verification = await verifyApiToken(token, undefined, testDrizzle);
        // Should not fail on format (but will fail on DB lookup)
        expect(verification.error).not.toBe('INVALID_FORMAT');
      }
    });

    it('should validate session token format', async () => {
      const validTokens = [
        'session_' + 'a'.repeat(64),
        'session_' + '1'.repeat(64), 
        'session_' + crypto.randomBytes(32).toString('hex'),
      ];
      
      for (const token of validTokens) {
        const verification = await verifySessionToken(token, testDrizzle);
        // Should not fail on format (but will fail on DB lookup)
        expect(verification.error).not.toBe('INVALID_FORMAT');
      }
    });
  });
});