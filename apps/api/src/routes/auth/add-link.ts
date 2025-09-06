import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { db } from '../../db/index.js'
import { links } from '../../db/schema.js'
import { sendSuccess, sendError } from '../../utils/response.js'
import { addLinkBodySchema, addLinkQuerySchema, extractDomain } from '../../utils/validation.js'
import { requireApiTokenOrAdminSession, logOperation } from '../../middleware/auth.js'
import { webScraper } from '../../services/web-scraper.js'
import { readabilityScraper } from '../../services/readability-scraper.js'
import { createAIAnalyzer, type AIAnalysisResult } from '../../services/ai-analyzer.js'
import { getSettings } from '../../utils/settings.js'
import type { AddLinkResponse } from '@magpie/shared'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

// Helper function to get unified auth data
function getAuthData(c: any) {
  const authType = c.get('authType')
  const tokenData = c.get('tokenData')
  const userData = c.get('userData')
  const clientIp = c.get('clientIp')
  
  if (authType === 'api_token') {
    return {
      userId: undefined, // API tokens don't have user association
      tokenId: tokenData?.id,
      clientIp,
      authType: 'api_token'
    }
  } else if (authType === 'admin_session' || authType === 'admin_jwt') {
    return {
      userId: userData?.id,
      tokenId: undefined,
      clientIp,
      authType: authType
    }
  }
  
  // Fallback for backward compatibility
  return {
    userId: tokenData ? undefined : userData?.id,
    tokenId: tokenData?.id,
    clientIp,
    authType: tokenData ? 'api_token' : 'admin_session'
  }
}

// Create add link router with optional database dependency injection
function createAddLinkRouter(database = db) {
  const app = new Hono()

// Error handling middleware
app.onError((err, c) => {
  console.error('Add Link API Error:', err)
  
  if (err instanceof HTTPException && err.status === 400) {
    return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
  }
  
  if (err.message.includes('ZodError') || err.name === 'ZodError') {
    return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
  }
  
  return sendError(c, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred', undefined, 500)
})

// Create fallback content when scraping fails
function createFallbackContent(url: string): {
  content: any;
  aiAnalysis: AIAnalysisResult;
  scrapingFailed: boolean;
  aiAnalysisFailed?: boolean;
  aiError?: string;
} {
  const domain = extractDomain(url)
  
  // Generate basic title from URL
  let titleFromUrl = url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .replace(/[-_]/g, ' ')
  
  // Try to get a meaningful title from path
  const pathParts = titleFromUrl.split('/').pop()
  if (pathParts && pathParts.length > 3) {
    titleFromUrl = pathParts.replace(/\.(html|php|aspx?)$/, '').replace(/[-_]/g, ' ')
  }
  
  const fallbackContent = {
    url,
    title: titleFromUrl || domain,
    description: `网页内容抓取失败，请手动输入描述`,
    content: '',
    domain,
    contentType: 'article' as const,
    wordCount: 0,
    language: 'zh-CN'
  }
  
  const fallbackAiAnalysis: AIAnalysisResult = {
    summary: `无法自动分析内容，请手动输入描述和分类`,
    category: '其他',
    tags: ['待分类'],
    language: 'zh-CN',
    sentiment: 'neutral',
    readingTime: 1
  }
  
  return {
    content: fallbackContent,
    aiAnalysis: fallbackAiAnalysis,
    scrapingFailed: true
  }
}

// Content processing service
async function processUrlContent(url: string, database: BetterSQLite3Database<any>): Promise<{
  content: any;
  aiAnalysis: AIAnalysisResult;
  scrapingFailed?: boolean;
  aiAnalysisFailed?: boolean;
  aiError?: string;
}> {
  // Step 1: Scrape web content using Readability (with fallback)
  let scrapedContent
  let scrapingFailed = false
  
  try {
    scrapedContent = await readabilityScraper.scrape(url)
  } catch (readabilityError) {
    console.warn('Readability scraper failed, trying web scraper:', readabilityError)
    try {
      // Readability scraper failed, falling back to original scraper
      scrapedContent = await webScraper.scrape(url)
    } catch (webScraperError) {
      console.warn('Both scrapers failed:', webScraperError)
      scrapingFailed = true
      
      // Return fallback content instead of throwing error
      return createFallbackContent(url)
    }
  }
  
  // Step 2: Get AI settings and analyze content
  let aiAnalysis: AIAnalysisResult
  let aiAnalysisFailed = false
  let aiError: string | undefined
  
  try {
    const settings = await getSettings(database)
    
    // Check if AI is configured
    if (!settings.openai_api_key) {
      throw new Error('AI service not configured')
    }
    
    const aiAnalyzer = await createAIAnalyzer(settings)
    aiAnalysis = await aiAnalyzer.analyze(scrapedContent)
  } catch (error) {
    console.warn('AI analysis failed, using basic analysis:', error)
    aiAnalysisFailed = true
    aiError = error instanceof Error ? error.message : 'Unknown AI analysis error'
    
    // Fallback to basic analysis
    aiAnalysis = {
      summary: scrapedContent.description || scrapedContent.title.substring(0, 200),
      category: 'other',
      tags: ['article'],
      language: scrapedContent.language,
      sentiment: 'neutral',
      readingTime: Math.max(1, Math.ceil(scrapedContent.wordCount / 225))
    }
  }
  
  return {
    content: scrapedContent,
    aiAnalysis,
    scrapingFailed,
    aiAnalysisFailed,
    aiError
  }
}

// Helper function to generate processing HTML page
function generateProcessingHTML(url: string, linkId: number): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Processing Link - Magpie</title>
    <style>
        body { font-family: system-ui, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .progress { width: 100%; height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden; margin: 20px 0; }
        .progress-bar { height: 100%; background: linear-gradient(90deg, #4CAF50, #45a049); width: 0%; transition: width 0.3s ease; animation: progress 3s ease-in-out forwards; }
        @keyframes progress { to { width: 100%; } }
        .url { word-break: break-all; color: #666; margin: 20px 0; padding: 10px; background: #f9f9f9; border-radius: 4px; }
        .status { margin: 20px 0; color: #333; }
        .spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #4CAF50; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 10px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <h2>🔗 Processing Link</h2>
        <div class="url">${url}</div>
        <div class="progress"><div class="progress-bar"></div></div>
        <div class="status">
            <span class="spinner"></span>
            <span id="status-text">Fetching content...</span>
        </div>
    </div>
    <script>
        const statusText = document.getElementById('status-text');
        const steps = [
            'Fetching content...',
            'Analyzing with AI...',
            'Processing complete!'
        ];
        let currentStep = 0;
        
        const updateStatus = () => {
            if (currentStep < steps.length - 1) {
                currentStep++;
                statusText.textContent = steps[currentStep];
                setTimeout(updateStatus, 1500);
            } else {
                // Redirect to confirm page
                setTimeout(() => {
                    window.location.href = '/confirm/${linkId}';
                }, 1000);
            }
        };
        
        setTimeout(updateStatus, 1500);
    </script>
</body>
</html>`.trim()
}

// GET /api/links/add - Add link processing page (for browser extension)
app.get('/add', requireApiTokenOrAdminSession(database), zValidator('query', addLinkQuerySchema, (result, c) => {
  if (!result.success) {
    return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
  }
}), async (c) => {
  const startTime = Date.now()
  
  try {
    const { url, skipConfirm, category, tags } = c.req.valid('query')
    const authData = getAuthData(c)

    // Extract domain
    const domain = extractDomain(url)

    // Process URL content (scrape + AI analysis)
    let processedContent
    try {
      processedContent = await processUrlContent(url, database)
    } catch (error) {
      console.warn('Unexpected error in processUrlContent, using fallback:', error)
      // Use fallback content as last resort
      processedContent = createFallbackContent(url)
    }

    const { content: scrapedContent, aiAnalysis, scrapingFailed, aiAnalysisFailed, aiError } = processedContent
    
    // Log if scraping failed for monitoring
    if (scrapingFailed) {
      await logOperation(
        'link_add',
        'links',
        undefined,
        { url, reason: 'scraping_failed_fallback_used', warning: 'Content scraping failed, using fallback' },
        authData.tokenId,
        authData.userId,
        authData.clientIp,
        c.req.header('user-agent'),
        'success', // Still mark as success since we continue the flow
        'Used fallback content due to scraping failure'
      )
    }
    
    // Log if AI analysis failed
    if (aiAnalysisFailed) {
      await logOperation(
        'link_add',
        'links',
        undefined,
        { url, reason: 'ai_analysis_failed', warning: 'AI analysis failed, using fallback', error: aiError },
        authData.tokenId,
        authData.userId,
        authData.clientIp,
        c.req.header('user-agent'),
        'success', // Still mark as success since we continue the flow
        'Used fallback content due to AI analysis failure'
      )
    }

    // Create final data
    const finalCategory = category || aiAnalysis.category
    const finalTags = tags ? tags.split(',').map(t => t.trim()) : aiAnalysis.tags
    const finalDescription = aiAnalysis.summary

    // Create link record
    const now = Math.floor(Date.now() / 1000)
    
    const linkData = {
      url,
      domain,
      title: scrapedContent.title,
      originalDescription: scrapedContent.description,
      aiSummary: aiAnalysis.summary,
      aiCategory: aiAnalysis.category,
      aiTags: JSON.stringify(aiAnalysis.tags),
      aiReadingTime: aiAnalysis.readingTime,
      aiAnalysisFailed: aiAnalysisFailed ? 1 : 0,
      aiError: aiError || null,
      // For skipConfirm (published), ensure all user fields are set
      userDescription: skipConfirm ? finalDescription : null,
      userCategory: skipConfirm ? finalCategory : null,
      userTags: skipConfirm ? JSON.stringify(finalTags) : null,
      status: skipConfirm ? 'published' as const : 'pending' as const,
      createdAt: now,
      publishedAt: skipConfirm ? now : undefined,
    }

    const result = await database.insert(links).values(linkData).returning({ id: links.id })
    const linkId = result[0].id

    // Log successful operation
    await logOperation(
      'link_add',
      'links',
      linkId,
      { url, skipConfirm, finalCategory, finalTags },
      authData.tokenId,
      authData.userId,
      authData.clientIp,
      c.req.header('user-agent'),
      'success',
      undefined,
      Date.now() - startTime
    )

    if (skipConfirm) {
      // Return JSON for API calls
      const response: AddLinkResponse = {
        id: linkId,
        url,
        title: scrapedContent.title,
        description: finalDescription,
        category: finalCategory,
        tags: finalTags,
        status: 'published',
        scrapingFailed,
        aiAnalysisFailed,
        aiError
      }
      return c.json(response)
    } else {
      // Return HTML processing page that will redirect to confirm page
      return c.html(generateProcessingHTML(url, linkId))
    }
  } catch (error) {
    console.error('Failed to add link:', error)
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to add link', undefined, 500)
  }
})

// POST /api/links - Add new link (authenticated)
app.post('/', requireApiTokenOrAdminSession(database), zValidator('json', addLinkBodySchema), async (c) => {
  const startTime = Date.now()
  
  try {
    const { url, skipConfirm, category, tags } = c.req.valid('json')
    const authData = getAuthData(c)

    // Extract domain
    const domain = extractDomain(url)

    // Process URL content (scrape + AI analysis)
    let processedContent
    try {
      processedContent = await processUrlContent(url, database)
    } catch (error) {
      console.warn('Unexpected error in processUrlContent, using fallback:', error)
      // Use fallback content as last resort
      processedContent = createFallbackContent(url)
    }

    const { content: scrapedContent, aiAnalysis, scrapingFailed, aiAnalysisFailed, aiError } = processedContent
    
    // Log if scraping failed for monitoring
    if (scrapingFailed) {
      await logOperation(
        'link_add',
        'links',
        undefined,
        { url, reason: 'scraping_failed_fallback_used', warning: 'Content scraping failed, using fallback' },
        authData.tokenId,
        authData.userId,
        authData.clientIp,
        c.req.header('user-agent'),
        'success', // Still mark as success since we continue the flow
        'Used fallback content due to scraping failure'
      )
    }
    
    // Log if AI analysis failed
    if (aiAnalysisFailed) {
      await logOperation(
        'link_add',
        'links',
        undefined,
        { url, reason: 'ai_analysis_failed', warning: 'AI analysis failed, using fallback', error: aiError },
        authData.tokenId,
        authData.userId,
        authData.clientIp,
        c.req.header('user-agent'),
        'success', // Still mark as success since we continue the flow
        'Used fallback content due to AI analysis failure'
      )
    }

    const now = Math.floor(Date.now() / 1000)

    // Parse user-provided tags
    const userTags = tags ? tags.split(',').map(t => t.trim()).filter(t => t.length > 0) : null

    // For skipConfirm (published), ensure all user fields are set
    // For pending links, user fields can be null and will be set during confirmation
    const linkData = {
      url,
      domain,
      title: scrapedContent.title || '',
      originalDescription: scrapedContent.description || '',
      aiSummary: aiAnalysis.summary,
      aiCategory: aiAnalysis.category,
      aiTags: JSON.stringify(aiAnalysis.tags),
      aiReadingTime: aiAnalysis.readingTime,
      aiAnalysisFailed: aiAnalysisFailed ? 1 : 0,
      aiError: aiError || null,
      userDescription: skipConfirm ? aiAnalysis.summary : null,
      userCategory: skipConfirm ? (category || aiAnalysis.category) : (category || null),
      userTags: skipConfirm ? JSON.stringify(userTags || aiAnalysis.tags) : (userTags ? JSON.stringify(userTags) : null),
      status: skipConfirm ? 'published' : 'pending',
      publishedAt: skipConfirm ? now : null,
      createdAt: now,
      updatedAt: now
    }

    // Insert into database
    const insertResult = await database
      .insert(links)
      .values(linkData)
      .returning({ id: links.id })

    const linkId = insertResult[0].id
    const duration = Date.now() - startTime

    // Log successful operation
    await logOperation(
      'link_add',
      'links',
      linkId,
      { 
        url, 
        skipConfirm, 
        category, 
        tags, 
        status: linkData.status,
        ai_analysis: aiAnalysis
      },
      authData.tokenId,
      authData.userId,
      authData.clientIp,
      c.req.header('user-agent'),
      'success',
      undefined,
      duration
    )

    if (skipConfirm) {
      // Return published link data (using user fields directly)
      const responseData: AddLinkResponse = {
        id: linkId,
        url,
        title: scrapedContent.title || '',
        description: linkData.userDescription!,
        category: linkData.userCategory!,
        tags: JSON.parse(linkData.userTags!),
        status: 'published',
        scrapingFailed: scrapingFailed,
        aiAnalysisFailed,
        aiError
      }
      
      return sendSuccess(c, responseData, 'Link added and published successfully')
    } else {
      // For browser-based usage, redirect to confirmation page
      // For API usage, this would typically return the link ID
      if (c.req.header('accept')?.includes('application/json')) {
        // API client - return link ID for confirmation
        return sendSuccess(c, { 
          id: linkId, 
          status: 'pending',
          confirmUrl: `/confirm/${linkId}`
        }, 'Link added, awaiting confirmation')
      } else {
        // Browser client - redirect to confirmation page
        return c.redirect(`/confirm/${linkId}`, 302)
      }
    }

  } catch (error) {
    const duration = Date.now() - startTime
    const authData = getAuthData(c)
    
    await logOperation(
      'link_add',
      'links',
      undefined,
      { error: String(error) },
      authData.tokenId,
      authData.userId,
      authData.clientIp,
      c.req.header('user-agent'),
      'failed',
      String(error),
      duration
    )
    
    console.error('Error adding link:', error)
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to add link', undefined, 500)
  }
})

  return app
}

// Export both the router factory and a default instance
export { createAddLinkRouter }
export default createAddLinkRouter()