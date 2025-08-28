#!/usr/bin/env tsx

import { db } from './index.js';
import { settings, apiTokens } from './schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const DEFAULT_SETTINGS = [
  // Site basic information
  { key: 'site_title', value: 'Magpie', type: 'string', description: '站点标题' },
  { key: 'site_description', value: '收集和分享有趣的链接', type: 'string', description: '站点描述' },
  { key: 'about_url', value: '', type: 'string', description: '关于页面URL' },
  
  // AI service configuration
  { key: 'ai_api_key', value: '', type: 'string', description: 'OpenAI API密钥' },
  { key: 'ai_base_url', value: 'https://api.openai.com/v1', type: 'string', description: 'AI API基础URL' },
  { key: 'ai_model', value: 'gpt-3.5-turbo', type: 'string', description: 'AI模型名称' },
  { key: 'ai_temperature', value: '0.7', type: 'number', description: 'AI温度参数' },
  
  // Prompt templates
  { 
    key: 'ai_summary_prompt', 
    value: '请分析以下网页内容，生成50字以内的中文摘要：\n\n标题：{title}\nURL：{url}\n内容：{content}\n\n要求：\n1. 简洁明了，突出核心观点\n2. 50字以内\n3. 使用中文', 
    type: 'string', 
    description: 'AI摘要生成提示词' 
  },
  { 
    key: 'ai_category_prompt', 
    value: '基于内容，从以下分类中选择最合适的1个：{categories}\n\n如果都不合适，可以建议新分类。', 
    type: 'string', 
    description: 'AI分类提示词' 
  },
  
  // Content settings
  { key: 'default_category', value: '其他', type: 'string', description: '默认分类' },
  { key: 'categories', value: '["技术", "设计", "产品", "工具", "其他"]', type: 'json', description: '可用分类列表' },
  { key: 'items_per_page', value: '20', type: 'number', description: '每页显示数量' },
  
  // System configuration
  { key: 'max_content_length', value: '10000', type: 'number', description: '最大内容长度' },
  { key: 'rate_limit_per_minute', value: '50', type: 'number', description: '每分钟请求限制' },
  
  // Database version
  { key: 'db_version', value: '1.0.0', type: 'string', description: '数据库版本' },
] as const;

async function seedDatabase() {
  console.log('Starting database seeding...');
  
  const now = Math.floor(Date.now() / 1000);
  
  try {
    // Insert default settings
    console.log('Inserting default settings...');
    
    for (const setting of DEFAULT_SETTINGS) {
      // Check if setting already exists
      const existing = await db.select().from(settings).where(eq(settings.key, setting.key)).limit(1);
      
      if (existing.length === 0) {
        await db.insert(settings).values({
          key: setting.key,
          value: setting.value,
          type: setting.type as 'string' | 'number' | 'boolean' | 'json',
          description: setting.description,
          createdAt: now,
          updatedAt: now,
        });
        console.log(`✓ Added setting: ${setting.key}`);
      } else {
        console.log(`- Setting already exists: ${setting.key}`);
      }
    }
    
    // Create initial admin API token if none exists
    console.log('Checking for admin API tokens...');
    
    const existingTokens = await db.select().from(apiTokens).limit(1);
    
    if (existingTokens.length === 0) {
      const tokenValue = 'mgp_' + crypto.randomBytes(32).toString('hex');
      
      await db.insert(apiTokens).values({
        token: tokenValue,
        name: 'Initial Admin Token',
        prefix: 'mgp_',
        status: 'active',
        createdAt: now,
      });
      
      console.log(`✓ Created initial admin token: ${tokenValue}`);
      console.log('  ⚠️  Please save this token - it will not be shown again!');
    } else {
      console.log('- Admin tokens already exist');
    }
    
    console.log('Database seeding completed successfully!');
    
  } catch (error) {
    console.error('Database seeding failed:', error);
    throw error;
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { seedDatabase };