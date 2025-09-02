import { db } from '../db/index.js'
import { settings } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

// Default system settings
const DEFAULT_SETTINGS = {
  site_title: 'Magpie',
  site_description: 'A lightweight bookmark collection and sharing platform',
  site_url: 'http://localhost:3000',
  admin_email: 'admin@magpie.local',
  
  // AI settings
  openai_api_key: '',
  openai_base_url: 'https://api.openai.com/v1',
  ai_model: 'gpt-3.5-turbo',
  ai_temperature: '0.7',
  ai_max_tokens: '1000',
  ai_timeout: '30000',
  
  // Categories (JSON string) - Chinese-focused
  categories: JSON.stringify(['技术', '设计', '产品', '工具', '其他']),
  
  ai_user_instructions: ''
}

// Get all settings as a key-value object
export async function getSettings(database: BetterSQLite3Database<any> = db): Promise<Record<string, any>> {
  try {
    const settingsRows = await database.select().from(settings)
    
    // Convert to key-value object
    const settingsObj: Record<string, any> = {}
    
    // Start with defaults
    Object.assign(settingsObj, DEFAULT_SETTINGS)
    
    // Override with database values
    for (const row of settingsRows) {
      try {
        switch (row.type) {
          case 'number':
            settingsObj[row.key] = parseFloat(row.value || '0')
            break
          case 'boolean':
            settingsObj[row.key] = row.value === 'true'
            break
          case 'json':
            settingsObj[row.key] = JSON.parse(row.value || '{}')
            break
          default:
            settingsObj[row.key] = row.value || ''
        }
      } catch (error) {
        console.warn(`Failed to parse setting ${row.key}:`, error)
        // Keep default value
      }
    }
    
    return settingsObj
  } catch (error) {
    console.error('Failed to get settings:', error)
    return DEFAULT_SETTINGS
  }
}

// Get a single setting value
export async function getSetting(key: string, database: BetterSQLite3Database<any> = db): Promise<any> {
  try {
    const result = await database
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1)
    
    if (result.length === 0) {
      return DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS]
    }
    
    const setting = result[0]
    switch (setting.type) {
      case 'number':
        return parseFloat(setting.value || '0')
      case 'boolean':
        return setting.value === 'true'
      case 'json':
        return JSON.parse(setting.value || '{}')
      default:
        return setting.value
    }
  } catch (error) {
    console.error(`Failed to get setting ${key}:`, error)
    return DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS]
  }
}

// Set a single setting value
export async function setSetting(
  key: string,
  value: any,
  type: 'string' | 'number' | 'boolean' | 'json' = 'string',
  description?: string,
  database: BetterSQLite3Database<any> = db
): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  
  let stringValue: string
  switch (type) {
    case 'number':
      stringValue = String(Number(value))
      break
    case 'boolean':
      stringValue = Boolean(value) ? 'true' : 'false'
      break
    case 'json':
      stringValue = typeof value === 'string' ? value : JSON.stringify(value)
      break
    default:
      stringValue = String(value)
  }
  
  // Try to update existing setting
  const updateResult = await database
    .update(settings)
    .set({
      value: stringValue,
      type,
      description,
      updatedAt: now
    })
    .where(eq(settings.key, key))
  
  // If no rows affected, insert new setting
  if (updateResult.changes === 0) {
    await database
      .insert(settings)
      .values({
        key,
        value: stringValue,
        type,
        description,
        createdAt: now,
        updatedAt: now
      })
  }
}

// Update multiple settings at once
export async function updateSettings(
  settingsData: Record<string, { value: any; type?: string; description?: string }>,
  database: BetterSQLite3Database<any> = db
): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  
  for (const [key, data] of Object.entries(settingsData)) {
    await setSetting(key, data.value, data.type as any, data.description, database)
  }
}

// Initialize default settings
export async function initializeSettings(database: BetterSQLite3Database<any> = db): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    // Check if setting already exists
    const existing = await database
      .select({ key: settings.key })
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1)
    
    if (existing.length === 0) {
      // Determine type
      let type: 'string' | 'number' | 'boolean' | 'json' = 'string'
      let stringValue = String(value)
      
      if (typeof value === 'number') {
        type = 'number'
      } else if (typeof value === 'boolean') {
        type = 'boolean'
        stringValue = value ? 'true' : 'false'
      } else if (key.endsWith('_json') || key === 'categories') {
        type = 'json'
      }
      
      await database
        .insert(settings)
        .values({
          key,
          value: stringValue,
          type,
          description: `Default ${key.replace(/_/g, ' ')} setting`,
          createdAt: now,
          updatedAt: now
        })
    }
  }
}