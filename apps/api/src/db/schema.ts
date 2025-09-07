import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

// Links table - Main content storage
export const links = sqliteTable('links', {
  // Primary key and basic info
  id: integer('id').primaryKey({ autoIncrement: true }),
  url: text('url').notNull(), // No unique constraint - allows duplicate collections
  domain: text('domain').notNull(),
  
  // Content information
  title: text('title'),
  originalDescription: text('original_description'),
  
  // AI processing results
  aiSummary: text('ai_summary'),
  aiCategory: text('ai_category'),
  aiTags: text('ai_tags'), // JSON array
  aiReadingTime: integer('ai_reading_time'), // AI estimated reading time in minutes
  aiAnalysisFailed: integer('ai_analysis_failed'), // 0 or 1 - whether AI analysis failed
  aiError: text('ai_error'), // Error message if AI analysis failed
  
  // User confirmed content
  userDescription: text('user_description'),
  userCategory: text('user_category'),
  userTags: text('user_tags'), // JSON array
  
  // Metadata
  status: text('status').default('pending').notNull(), // pending|published|deleted
  clickCount: integer('click_count').default(0).notNull(),
  
  // Timestamps (Unix timestamps)
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at'),
  publishedAt: integer('published_at'),
}, (table) => ({
  // Indexes for common queries
  statusIdx: index('idx_links_status').on(table.status),
  domainIdx: index('idx_links_domain').on(table.domain),
  publishedAtIdx: index('idx_links_published_at').on(table.publishedAt),
  createdAtIdx: index('idx_links_created_at').on(table.createdAt),
  statusPublishedAtIdx: index('idx_links_status_published_at').on(table.status, table.publishedAt),
}));

// Settings table - System configuration
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  type: text('type').default('string').notNull(), // string|number|boolean|json
  description: text('description'),
  
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// Categories table - Category management with icons
export const categories = sqliteTable('categories', {
  // Primary key
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // Basic information
  name: text('name').unique().notNull(),
  slug: text('slug').unique(),
  
  // Display configuration
  icon: text('icon').default('folder').notNull(), // Preset icon name
  color: text('color'), // Hex color value
  description: text('description'),
  
  // Sort and status
  displayOrder: integer('display_order').default(0).notNull(),
  isActive: integer('is_active').default(1).notNull(), // 0=disabled, 1=enabled
  
  // Timestamps
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at'),
}, (table) => ({
  // Indexes for common queries
  displayOrderIdx: index('idx_categories_display_order').on(table.displayOrder),
  isActiveIdx: index('idx_categories_is_active').on(table.isActive),
  slugIdx: index('idx_categories_slug').on(table.slug),
}));

// API tokens table - Access control
export const apiTokens = sqliteTable('api_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // Token information
  token: text('token').unique().notNull(),
  name: text('name'),
  prefix: text('prefix'),
  
  // Status
  status: text('status').default('active').notNull(), // active|revoked
  
  // Usage statistics
  usageCount: integer('usage_count').default(0).notNull(),
  lastUsedAt: integer('last_used_at'),
  lastUsedIp: text('last_used_ip'),
  
  // Time management
  createdAt: integer('created_at').notNull(),
  revokedAt: integer('revoked_at'),
}, (table) => ({
  statusIdx: index('idx_tokens_status').on(table.status),
  lastUsedIdx: index('idx_tokens_last_used').on(table.lastUsedAt),
}));

// Users table - Admin accounts
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // Account information
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  salt: text('salt').notNull(),
  
  // User information
  email: text('email'),
  displayName: text('display_name'),
  
  // Permissions and status
  role: text('role').default('admin').notNull(), // admin
  status: text('status').default('active').notNull(), // active|suspended|deleted
  
  // Login related
  lastLoginAt: integer('last_login_at'),
  lastLoginIp: text('last_login_ip'),
  loginAttempts: integer('login_attempts').default(0).notNull(),
  lockedUntil: integer('locked_until'),
  
  // Session management
  sessionToken: text('session_token'),
  sessionExpiresAt: integer('session_expires_at'),
  
  // Timestamps
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at'),
}, (table) => ({
  usernameIdx: index('idx_users_username').on(table.username),
  sessionTokenIdx: index('idx_users_session_token').on(table.sessionToken),
  statusIdx: index('idx_users_status').on(table.status),
  lastLoginIdx: index('idx_users_last_login').on(table.lastLoginAt),
}));

// Operation logs table - Audit trail
export const operationLogs = sqliteTable('operation_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // Operation information
  action: text('action').notNull(), // link_add|link_publish|link_delete|token_create etc
  resource: text('resource'), // links|settings|tokens
  resourceId: integer('resource_id'),
  
  // Operation details
  details: text('details'), // JSON format
  status: text('status').default('success').notNull(), // success|failed|pending
  errorMessage: text('error_message'),
  
  // Request information
  userAgent: text('user_agent'),
  ip: text('ip'),
  tokenId: integer('token_id'),
  userId: integer('user_id'),
  
  // Performance information
  duration: integer('duration'), // milliseconds
  
  // Timestamp
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  createdAtIdx: index('idx_logs_created_at').on(table.createdAt),
  actionIdx: index('idx_logs_action').on(table.action),
  resourceIdx: index('idx_logs_resource').on(table.resource, table.resourceId),
  userIdIdx: index('idx_logs_user_id').on(table.userId),
  tokenIdIdx: index('idx_logs_token_id').on(table.tokenId),
}));

// Search logs table - Search analytics
export const searchLogs = sqliteTable('search_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // Search information
  query: text('query').notNull(),
  normalizedQuery: text('normalized_query'),
  resultsCount: integer('results_count'),
  responseTime: integer('response_time'), // milliseconds
  
  // Filter conditions
  filters: text('filters'), // JSON format
  sortBy: text('sort_by'),
  
  // User behavior
  clickedResults: text('clicked_results'), // JSON array
  noResultsFound: integer('no_results_found', { mode: 'boolean' }).default(false),
  
  // Request information
  ip: text('ip'),
  userAgent: text('user_agent'),
  
  // Timestamp
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  queryIdx: index('idx_search_query').on(table.query),
  createdAtIdx: index('idx_search_created_at').on(table.createdAt),
  noResultsIdx: index('idx_search_no_results').on(table.noResultsFound),
}));

// FTS5 Full-Text Search Virtual Table
// Note: FTS5 virtual tables are created manually in SQL migration files
// because Drizzle ORM doesn't have native support for FTS5 syntax.
// The actual table is created with:
// CREATE VIRTUAL TABLE `links_fts` USING fts5(title, description, tags, domain, category, content=links, content_rowid=id);
// 
// This schema definition is for TypeScript typing only and should not be used for migrations.
// The FTS5 table and triggers are manually maintained in SQL migration files.

// Commented out to prevent Drizzle from trying to manage this as a regular table
// export const linksFts = sqliteTable('links_fts', {
//   rowid: integer('rowid').primaryKey(),
//   title: text('title'),
//   description: text('description'),
//   tags: text('tags'), 
//   domain: text('domain'),
//   category: text('category'),
// });

// Type exports for TypeScript
export type Link = typeof links.$inferSelect;
export type NewLink = typeof links.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type ApiToken = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type OperationLog = typeof operationLogs.$inferSelect;
export type NewOperationLog = typeof operationLogs.$inferInsert;
export type SearchLog = typeof searchLogs.$inferSelect;
export type NewSearchLog = typeof searchLogs.$inferInsert;