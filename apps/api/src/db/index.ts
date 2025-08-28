import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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

// Enable foreign keys and optimize settings
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('journal_mode = WAL'); // Better performance for concurrent access
sqlite.pragma('synchronous = NORMAL'); // Good balance of safety and speed

// Create drizzle instance
export const db = drizzle(sqlite, { schema });

// Export sqlite instance for raw SQL operations
export { sqlite };

// Initialize database (run migrations)
export async function initializeDatabase() {
  try {
    console.log(`Initializing database at: ${dbPath}`);
    
    // Run migrations
    const migrationsPath = path.join(__dirname, '../../drizzle');
    
    if (!fs.existsSync(migrationsPath)) {
      console.warn(`Migrations directory not found: ${migrationsPath}`);
      return;
    }
    
    migrate(db, { migrationsFolder: migrationsPath });
    
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

// Close database connection
export function closeDatabase() {
  sqlite.close();
}