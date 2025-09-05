import { z } from 'zod'

// 基础验证模式
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export const idParamSchema = z.object({
  id: z.coerce.number().min(1),
})

// 链接相关验证模式
export const linksQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  category: z.string().optional(),
  tags: z.string().optional(),
  search: z.string().optional(),
  domain: z.string().optional(),
  year: z.coerce.number().min(2000).max(2030).optional(),
  month: z.coerce.number().min(1).max(12).optional(),
  sort: z.enum(['newest', 'oldest', 'title', 'domain']).default('newest'),
  status: z.enum(['published']).default('published'),
  id: z.coerce.number().min(1).optional(), // 按ID搜索
})

export const searchQuerySchema = z.object({
  q: z.string().min(1),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  category: z.string().optional(),
  tags: z.string().optional(),
  domain: z.string().optional(),
  before: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD
  after: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sort: z.enum(['relevance', 'newest', 'oldest']).default('relevance'),
  highlight: z.coerce.boolean().default(true),
})

export const suggestionsQuerySchema = z.object({
  q: z.string().min(1),
  type: z.enum(['title', 'tag', 'category', 'domain']).optional(),
  limit: z.coerce.number().min(1).max(50).default(10),
})

export const addLinkQuerySchema = z.object({
  url: z.string().url(),
  skipConfirm: z.string().optional().transform(val => {
    if (!val) return false
    return val.toLowerCase() === 'true'
  }),
  category: z.string().optional(),
  tags: z.string().optional(),
})

export const addLinkBodySchema = z.object({
  url: z.string().url(),
  skipConfirm: z.boolean().default(false),
  category: z.string().optional(),
  tags: z.string().optional(),
})

export const confirmLinkSchema = z.object({
  title: z.string().optional(),
  description: z.string().min(1).max(1000),
  category: z.string().min(1).max(100).optional(),
  tags: z.array(z.string().max(50)).optional(),
  publish: z.boolean().default(true),
})

export const updateLinkSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).optional(),
  status: z.enum(['pending', 'published', 'deleted']).optional(),
})

// 管理员相关验证模式
export const adminLoginSchema = z.object({
  password: z.string().min(1),
})

export const adminInitSchema = z.object({
  password: z.string().min(8).max(100),
})

export const adminPendingQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sort: z.enum(['newest', 'oldest']).default('newest'),
  domain: z.string().optional(),
  category: z.string().optional(),
})

// Admin links query schema
export const adminLinksQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['published', 'pending', 'deleted', 'all']).default('all'),
  sort: z.enum(['newest', 'oldest', 'title', 'domain']).default('newest'),
  category: z.string().optional(),
  domain: z.string().optional(),
})

export const createTokenSchema = z.object({
  name: z.string().max(100).optional(),
  expiresAt: z.string().datetime().optional(),
})

export const batchOperationSchema = z.object({
  ids: z.array(z.number().min(1)).min(1).max(100),
  action: z.enum(['confirm', 'delete', 'reanalyze']),
  params: z.object({
    category: z.string().max(100).optional(),
    tags: z.array(z.string().max(50)).optional(),
  }).optional(),
})

export const updateSettingsSchema = z.object({
  site: z.object({
    title: z.string().max(200).optional(),
    description: z.string().max(500).optional(),
    aboutUrl: z.string().url().optional(),
  }).optional(),
  ai: z.object({
    apiKey: z.string().optional(),
    baseUrl: z.string().url().optional(),
    model: z.string().max(100).optional(),
    temperature: z.number().min(0).max(2).optional(),
    summaryPrompt: z.string().max(1000).optional(),
    categoryPrompt: z.string().max(1000).optional(),
  }).optional(),
  content: z.object({
    defaultCategory: z.string().max(100).optional(),
    categories: z.array(z.string().max(100)).optional(),
    itemsPerPage: z.number().min(1).max(100).optional(),
  }).optional(),
})

// 工具函数：URL域名提取
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace(/^www\./, '')
  } catch {
    return 'unknown'
  }
}

// 工具函数：标签字符串解析
export function parseTags(tagsString: string): string[] {
  if (!tagsString) return []
  return tagsString
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
    .slice(0, 10) // 最多10个标签
}

// 工具函数：日期范围查询构建
export function buildDateFilter(year?: number, month?: number) {
  if (!year && !month) return null
  
  if (year && month) {
    const startOfMonth = Math.floor(new Date(year, month - 1, 1).getTime() / 1000)
    const endOfMonth = Math.floor(new Date(year, month, 0, 23, 59, 59).getTime() / 1000)
    return { start: startOfMonth, end: endOfMonth }
  } else if (year) {
    const startOfYear = Math.floor(new Date(year, 0, 1).getTime() / 1000)
    const endOfYear = Math.floor(new Date(year, 11, 31, 23, 59, 59).getTime() / 1000)
    return { start: startOfYear, end: endOfYear }
  }
  
  return null
}

// 工具函数：搜索日期范围
export function buildSearchDateFilter(before?: string, after?: string) {
  const filters: { start?: number; end?: number } = {}
  
  if (after) {
    filters.start = Math.floor(new Date(after).getTime() / 1000)
  }
  
  if (before) {
    filters.end = Math.floor(new Date(before + ' 23:59:59').getTime() / 1000)
  }
  
  return Object.keys(filters).length > 0 ? filters : null
}