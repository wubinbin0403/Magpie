import { beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../db/schema.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test database setup
let testDb: ReturnType<typeof Database>;
let testDrizzle: ReturnType<typeof drizzle>;

// Create a unique test database for each test run
const testDbPath = path.join(__dirname, `test_${Date.now()}_${Math.random().toString(36).substring(7)}.db`);

beforeAll(async () => {
  // Create test database
  testDb = new Database(testDbPath);
  testDb.pragma('foreign_keys = ON');
  testDb.pragma('journal_mode = MEMORY'); // Faster for tests
  
  // Create drizzle instance
  testDrizzle = drizzle(testDb, { schema });
  
  // Run migrations for test database
  const migrationsPath = path.join(__dirname, '../../drizzle');
  if (fs.existsSync(migrationsPath)) {
    migrate(testDrizzle, { migrationsFolder: migrationsPath });
  }
});

afterAll(() => {
  // Close and clean up test database
  if (testDb) {
    testDb.close();
  }
  
  // Remove test database file
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

beforeEach(() => {
  // Clean up data before each test (but keep schema)
  const tables = ['operation_logs', 'search_logs', 'links', 'api_tokens', 'users', 'settings'];
  
  for (const table of tables) {
    try {
      testDb.exec(`DELETE FROM ${table}`);
    } catch (error) {
      // Ignore errors for non-existent tables
    }
  }
});

// Export test database instances for use in tests
export { testDb, testDrizzle };