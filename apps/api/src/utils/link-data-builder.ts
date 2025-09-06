import type { AIAnalysisResult } from '../services/ai-analyzer.js'
import type { ScrapedContent } from '../services/web-scraper.js'

export interface LinkDataBuilderParams {
  url: string
  domain: string
  scrapedContent: ScrapedContent
  aiAnalysis: AIAnalysisResult
  aiAnalysisFailed: boolean
  aiError?: string | null
  skipConfirm: boolean
  category?: string | null
  tags?: string[] | null
  now: number
  // Optional override for user field handling (used for stream mode)
  forceUserFields?: boolean
}

export function buildLinkData({
  url,
  domain,
  scrapedContent,
  aiAnalysis,
  aiAnalysisFailed,
  aiError,
  skipConfirm,
  category,
  tags,
  now,
  forceUserFields = false
}: LinkDataBuilderParams) {
  // Determine title with priority: AI title > scraped title > empty string
  const title = aiAnalysis.title || scrapedContent.title || ''
  
  // Handle user fields based on skipConfirm flag or forceUserFields override
  const userDescription = forceUserFields 
    ? null  // Stream mode always uses null
    : (skipConfirm ? aiAnalysis.summary : null)
    
  const userCategory = forceUserFields
    ? (category || null)  // Stream mode: simple fallback
    : (skipConfirm ? (category || aiAnalysis.category) : (category || null))
    
  const userTags = forceUserFields
    ? (tags ? JSON.stringify(tags) : null)  // Stream mode: simple conversion
    : (skipConfirm 
        ? JSON.stringify(tags || aiAnalysis.tags) 
        : (tags ? JSON.stringify(tags) : null))

  return {
    url,
    domain,
    title,
    originalDescription: scrapedContent.description || '',
    aiSummary: aiAnalysis.summary,
    aiCategory: aiAnalysis.category,
    aiTags: JSON.stringify(aiAnalysis.tags),
    aiReadingTime: aiAnalysis.readingTime,
    aiAnalysisFailed: aiAnalysisFailed ? 1 : 0,
    aiError: aiError || null,
    userDescription,
    userCategory,
    userTags,
    status: skipConfirm ? 'published' as const : 'pending' as const,
    publishedAt: skipConfirm ? now : null,
    createdAt: now,
    updatedAt: now
  }
}