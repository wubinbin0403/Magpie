#!/usr/bin/env tsx

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, sqlite } from './index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  console.log('Running database migrations...');
  
  try {
    const migrationsPath = path.join(__dirname, '../../drizzle');
    migrate(db, { migrationsFolder: migrationsPath });
    
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    sqlite.close();
  }
}

runMigrations();