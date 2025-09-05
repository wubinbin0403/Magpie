/**
 * 爬虫检测工具
 * 用于识别搜索引擎爬虫和社交媒体爬虫
 */

const BOT_PATTERNS = [
  // 主要搜索引擎爬虫
  /googlebot/i,
  /bingbot/i,
  /slurp/i,        // Yahoo
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  
  // 社交媒体爬虫
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /whatsapp/i,
  /telegrambot/i,
  
  // 通用爬虫标识
  /bot/i,
  /crawler/i,
  /spider/i,
  /crawling/i,
  /scraper/i,
  
  // SEO工具
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /dotbot/i,
]

/**
 * 检测User-Agent是否属于爬虫
 */
export function isBot(userAgent: string): boolean {
  if (!userAgent) return false
  
  return BOT_PATTERNS.some(pattern => pattern.test(userAgent))
}

/**
 * 获取爬虫类型（用于日志记录）
 */
export function getBotType(userAgent: string): string {
  if (!userAgent) return 'unknown'
  
  const ua = userAgent.toLowerCase()
  
  if (ua.includes('googlebot')) return 'googlebot'
  if (ua.includes('bingbot')) return 'bingbot'
  if (ua.includes('baiduspider')) return 'baiduspider'
  if (ua.includes('yandexbot')) return 'yandexbot'
  if (ua.includes('facebookexternalhit')) return 'facebook'
  if (ua.includes('twitterbot')) return 'twitter'
  if (ua.includes('linkedinbot')) return 'linkedin'
  if (ua.includes('bot')) return 'generic_bot'
  if (ua.includes('crawler')) return 'generic_crawler'
  if (ua.includes('spider')) return 'generic_spider'
  
  return 'unknown_bot'
}