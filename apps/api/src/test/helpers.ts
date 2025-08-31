import { testDb, testDrizzle } from './setup.js';
import { users } from '../db/schema.js';
import { seedDatabase } from '../db/seed.js';

/**
 * Seed test database using the existing seed function
 * This ensures consistency between production and test seeding
 */
export async function seedTestDatabase() {
  // Temporarily disable console output during testing
  const originalLog = console.log;
  console.log = () => {};
  
  try {
    const result = await seedDatabase(testDrizzle);
    return result;
  } finally {
    // Restore console.log
    console.log = originalLog;
  }
}

/**
 * Create test admin user
 */
export async function createTestAdminUser(username = 'admin', password = 'testpassword') {
  const bcrypt = await import('bcrypt');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  
  const now = Math.floor(Date.now() / 1000);
  
  const result = await testDrizzle.insert(users).values({
    username,
    passwordHash,
    salt,
    role: 'admin',
    status: 'active',
    createdAt: now,
  }).returning();
  
  return result[0];
}

/**
 * Get test database statistics
 */
export function getTestDbStats() {
  const stats = {
    settings: testDb.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number },
    apiTokens: testDb.prepare('SELECT COUNT(*) as count FROM api_tokens').get() as { count: number },
    users: testDb.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number },
    links: testDb.prepare('SELECT COUNT(*) as count FROM links').get() as { count: number },
  };
  
  return {
    settings: stats.settings.count,
    apiTokens: stats.apiTokens.count,
    users: stats.users.count,
    links: stats.links.count,
  };
}

/**
 * Clear all test data
 */
export function clearTestData() {
  const tables = ['operation_logs', 'search_logs', 'links', 'api_tokens', 'users', 'categories', 'settings'];
  
  // 先禁用外键约束
  testDb.exec('PRAGMA foreign_keys = OFF');
  
  for (const table of tables) {
    try {
      testDb.exec(`DELETE FROM ${table}`);
    } catch (error) {
      console.warn(`Failed to clear table ${table}:`, error);
    }
  }
  
  // 重新启用外键约束
  testDb.exec('PRAGMA foreign_keys = ON');
}