import { defineConfig } from 'drizzle-kit';
import path from 'path';
import fs from 'fs';

// Find project root by looking for pnpm-workspace.yaml
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

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbPath,
  },
  verbose: true,
  strict: true,
});