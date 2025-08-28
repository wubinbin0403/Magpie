import { describe, it, expect, beforeEach } from 'vitest';
import { testDrizzle } from './setup.js';
import { seedTestDatabase, getTestDbStats, clearTestData } from './helpers.js';
import { settings, apiTokens } from '../db/schema.js';
import { eq } from 'drizzle-orm';

describe('Database Initialization', () => {
  beforeEach(() => {
    clearTestData();
  });

  it('should create database tables successfully', () => {
    const stats = getTestDbStats();
    
    // Tables should exist (count should be 0 initially)
    expect(stats.settings).toBe(0);
    expect(stats.apiTokens).toBe(0);
    expect(stats.users).toBe(0);
    expect(stats.links).toBe(0);
  });

  it('should seed default settings correctly', async () => {
    await seedTestDatabase();
    
    // Check that settings were inserted
    const allSettings = await testDrizzle.select().from(settings);
    expect(allSettings.length).toBeGreaterThan(0);
    
    // Check specific required settings
    const siteTitle = await testDrizzle.select()
      .from(settings)
      .where(eq(settings.key, 'site_title'))
      .limit(1);
    
    expect(siteTitle).toHaveLength(1);
    expect(siteTitle[0].value).toBe('Magpie');
    expect(siteTitle[0].type).toBe('string');
    
    // Check database version
    const dbVersion = await testDrizzle.select()
      .from(settings)
      .where(eq(settings.key, 'db_version'))
      .limit(1);
      
    expect(dbVersion).toHaveLength(1);
    expect(dbVersion[0].value).toBe('1.0.0');
  });

  it('should create initial admin API token', async () => {
    const result = await seedTestDatabase();
    
    // Check that token was created
    const tokens = await testDrizzle.select().from(apiTokens);
    expect(tokens).toHaveLength(1);
    
    const token = tokens[0];
    expect(token.name).toBe('Initial Admin Token');
    expect(token.prefix).toBe('mgp_');
    expect(token.status).toBe('active');
    expect(token.usageCount).toBe(0);
    
    // Verify token format
    expect(token.token).toMatch(/^mgp_[a-f0-9]{64}$/);
    
    // Verify returned token matches database
    expect(result?.tokenValue).toBe(token.token);
  });

  it('should not create duplicate admin tokens', async () => {
    // First seeding
    await seedTestDatabase();
    const tokensAfterFirst = await testDrizzle.select().from(apiTokens);
    expect(tokensAfterFirst).toHaveLength(1);
    
    // Second seeding should not create another token
    const result = await seedTestDatabase();
    const tokensAfterSecond = await testDrizzle.select().from(apiTokens);
    expect(tokensAfterSecond).toHaveLength(1);
    expect(result?.tokenValue).toBeNull();
  });

  it('should create settings with proper timestamps', async () => {
    const beforeTime = Math.floor(Date.now() / 1000);
    await seedTestDatabase();
    const afterTime = Math.floor(Date.now() / 1000);
    
    const siteTitle = await testDrizzle.select()
      .from(settings)
      .where(eq(settings.key, 'site_title'))
      .limit(1);
      
    expect(siteTitle[0].createdAt).toBeGreaterThanOrEqual(beforeTime);
    expect(siteTitle[0].createdAt).toBeLessThanOrEqual(afterTime);
    expect(siteTitle[0].updatedAt).toBeGreaterThanOrEqual(beforeTime);
    expect(siteTitle[0].updatedAt).toBeLessThanOrEqual(afterTime);
  });

  it('should handle JSON settings correctly', async () => {
    await seedTestDatabase();
    
    const categories = await testDrizzle.select()
      .from(settings)
      .where(eq(settings.key, 'categories'))
      .limit(1);
      
    expect(categories).toHaveLength(1);
    expect(categories[0].type).toBe('json');
    expect(categories[0].value).toBe('["技术", "设计", "产品", "工具", "其他"]');
    
    // Verify it's valid JSON
    const parsedCategories = JSON.parse(categories[0].value);
    expect(Array.isArray(parsedCategories)).toBe(true);
    expect(parsedCategories).toContain('技术');
    expect(parsedCategories).toContain('设计');
    expect(parsedCategories).toContain('产品');
  });

  it('should create API token with proper format and metadata', async () => {
    const beforeTime = Math.floor(Date.now() / 1000);
    const result = await seedTestDatabase();
    const afterTime = Math.floor(Date.now() / 1000);
    
    const tokens = await testDrizzle.select().from(apiTokens);
    expect(tokens).toHaveLength(1);
    
    const tokenData = tokens[0];
    
    // Check token format (mgp_ + 64 hex characters)
    expect(tokenData.token).toMatch(/^mgp_[a-f0-9]{64}$/);
    
    // Check metadata
    expect(tokenData.name).toBe('Initial Admin Token');
    expect(tokenData.prefix).toBe('mgp_');
    expect(tokenData.status).toBe('active');
    expect(tokenData.usageCount).toBe(0);
    expect(tokenData.lastUsedAt).toBeNull();
    expect(tokenData.lastUsedIp).toBeNull();
    expect(tokenData.revokedAt).toBeNull();
    
    // Check timestamp
    expect(tokenData.createdAt).toBeGreaterThanOrEqual(beforeTime);
    expect(tokenData.createdAt).toBeLessThanOrEqual(afterTime);
    
    // Verify result matches database
    expect(result?.tokenValue).toBe(tokenData.token);
  });

  it('should seed all required settings', async () => {
    await seedTestDatabase();
    
    // Required settings that should always be present
    const requiredSettings = [
      'site_title',
      'site_description', 
      'ai_base_url',
      'ai_model',
      'categories',
      'db_version'
    ];
    
    for (const settingKey of requiredSettings) {
      const setting = await testDrizzle.select()
        .from(settings)
        .where(eq(settings.key, settingKey))
        .limit(1);
        
      expect(setting).toHaveLength(1);
      expect(setting[0].key).toBe(settingKey);
      expect(setting[0].value).toBeDefined();
      expect(setting[0].description).toBeDefined();
    }
  });
});