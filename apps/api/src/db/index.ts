import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { systemLogger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Database file path - find project root and use data directory there
const findProjectRoot = () => {
  let currentDir = process.cwd();
  while (currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  return process.cwd(); // fallback
};

const projectRoot = findProjectRoot();
const dbPath = process.env.DATABASE_URL || path.join(projectRoot, 'data', 'magpie.db');
const dataDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create better-sqlite3 instance
const sqlite = new Database(dbPath);

// Enable foreign keys and optimize settings for container environment
sqlite.pragma('foreign_keys = ON');
// Use DELETE mode instead of WAL for better data persistence in containers
// WAL mode can cause data sync issues when containers are stopped/started
sqlite.pragma('journal_mode = DELETE'); 
// Use FULL synchronous mode to ensure data is written to disk immediately
sqlite.pragma('synchronous = FULL');
// Set a reasonable timeout for busy database
sqlite.pragma('busy_timeout = 30000'); // 30 seconds

// Create drizzle instance
export const db = drizzle(sqlite, { schema });

// Export sqlite instance for raw SQL operations
export { sqlite };

// Initialize database (run migrations)
export async function initializeDatabase() {
  try {
    systemLogger.info('Initializing database', { dbPath });
    
    // Run migrations
    const migrationsPath = path.join(__dirname, '../../drizzle');
    
    if (!fs.existsSync(migrationsPath)) {
      systemLogger.warn('Migrations directory not found', { migrationsPath });
      return;
    }
    
    migrate(db, { migrationsFolder: migrationsPath });
    
    systemLogger.info('Database migrations completed successfully');
  } catch (error) {
    systemLogger.error('Failed to initialize database', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

// Close database connection
export function closeDatabase() {
  sqlite.close();
}
