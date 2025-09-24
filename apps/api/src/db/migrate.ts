#!/usr/bin/env tsx

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, sqlite } from './index.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationLogger = createLogger('db-migrate');

async function runMigrations() {
  migrationLogger.info('Running database migrations');
  
  try {
    const migrationsPath = path.join(__dirname, '../../drizzle');
    migrate(db, { migrationsFolder: migrationsPath });
    
    migrationLogger.info('Migrations completed successfully');
  } catch (error) {
    migrationLogger.error('Migration failed', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  } finally {
    sqlite.close();
  }
}

runMigrations();
