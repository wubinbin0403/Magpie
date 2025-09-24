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
import { buildLinkData } from '../../utils/link-data-builder.js'
import { apiLogger, logApiRequest, logScraping, logAiAnalysis } from '../../utils/logger.js'
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
  apiLogger.error('Add Link API error', {
    error: err instanceof Error ? err.message : err,
    stack: err instanceof Error ? err.stack : undefined
  })
  
  if (err instanceof HTTPException && err.status === 400) {
    return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
  }
  
  if (err instanceof Error && (err.message.includes('ZodError') || err.name === 'ZodError')) {
    return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
  }
  
  return sendError(c, 'INTERNAL_SERVER_ERROR', 'An internal server error occurred', undefined, 500)
})

// Create fallback content when scraping fails
async function createFallbackContent(url: string, database: BetterSQLite3Database<any> = db): Promise<{
  content: any;
  aiAnalysis: AIAnalysisResult;
  scrapingFailed: boolean;
  aiAnalysisFailed?: boolean;
  aiError?: string;
}> {
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
  
  // Get default category from settings
  const settings = await getSettings(database)
  const defaultCategory = settings.default_category || '其他'
  
  const fallbackAiAnalysis: AIAnalysisResult = {
    summary: `无法自动分析内容，请手动输入描述和分类`,
    category: defaultCategory,
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
  logScraping(url, 'start')
  const scrapingStartTime = Date.now()

  let scrapedContent
  let scrapingFailed = false

  try {
    scrapedContent = await readabilityScraper.scrape(url)
    const scrapingDuration = Date.now() - scrapingStartTime
    logScraping(url, 'success', scrapingDuration, scrapedContent.content?.length)

    apiLogger.debug('Content scraping successful', {
      url,
      title: scrapedContent.title,
      contentLength: scrapedContent.content?.length,
      wordCount: scrapedContent.wordCount,
      language: scrapedContent.language,
      duration: scrapingDuration
    })
  } catch (readabilityError) {
    const errorMessage = readabilityError instanceof Error ? readabilityError.message : String(readabilityError)
    apiLogger.warn('Readability scraper failed, trying web scraper', { url, error: errorMessage })
    try {
      // Readability scraper failed, falling back to original scraper
      scrapedContent = await webScraper.scrape(url)
      const scrapingDuration = Date.now() - scrapingStartTime
      logScraping(url, 'success', scrapingDuration, scrapedContent.content?.length)

      apiLogger.info('Web scraper fallback successful', {
        url,
        title: scrapedContent.title,
        contentLength: scrapedContent.content?.length,
        duration: scrapingDuration
      })
    } catch (webScraperError) {
      const scrapingDuration = Date.now() - scrapingStartTime
      logScraping(url, 'error', scrapingDuration, undefined, webScraperError)

      apiLogger.error('Both scrapers failed', {
        url,
        readabilityError: readabilityError instanceof Error ? readabilityError.message : String(readabilityError),
        webScraperError: webScraperError instanceof Error ? webScraperError.message : String(webScraperError),
        duration: scrapingDuration
      })

      scrapingFailed = true

      // Return fallback content instead of throwing error
      return await createFallbackContent(url, database)
    }
  }
  
  // Step 2: Get AI settings and analyze content
  logAiAnalysis(url, 'start')
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

    // Log AI analysis details
    const contentPreview = scrapedContent.content?.substring(0, 500) + '...'
    const promptInfo = `Analyzing content for: ${scrapedContent.title}, Word count: ${scrapedContent.wordCount}, Language: ${scrapedContent.language}`

    apiLogger.info('Starting AI analysis', {
      url,
      title: scrapedContent.title,
      wordCount: scrapedContent.wordCount,
      language: scrapedContent.language,
      contentPreview,
      promptInfo
    })

    aiAnalysis = await aiAnalyzer.analyze(scrapedContent)

    logAiAnalysis(url, 'success', promptInfo, aiAnalysis)

    apiLogger.info('AI analysis completed successfully', {
      url,
      result: {
        summary: aiAnalysis.summary.substring(0, 200) + '...',
        category: aiAnalysis.category,
        tags: aiAnalysis.tags,
        language: aiAnalysis.language,
        sentiment: aiAnalysis.sentiment,
        readingTime: aiAnalysis.readingTime
      }
    })
  } catch (error) {
    aiAnalysisFailed = true
    aiError = error instanceof Error ? error.message : 'Unknown AI analysis error'

    logAiAnalysis(url, 'error', undefined, undefined, error)

    apiLogger.warn('AI analysis failed, using basic analysis', {
      url,
      error: aiError,
      title: scrapedContent.title
    })

    // Fallback to basic analysis
    // Get settings from database for default category
    const fallbackSettings = await getSettings(database)
    const defaultCategory = fallbackSettings.default_category || '其他'
    aiAnalysis = {
      summary: scrapedContent.description || scrapedContent.title.substring(0, 200),
      category: defaultCategory,
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

    // Log API request
    logApiRequest('GET', `/api/links/add`, undefined, undefined, {
      url,
      skipConfirm,
      category,
      tags,
      authType: authData.authType,
      userAgent: c.req.header('user-agent'),
      clientIp: authData.clientIp
    })

    apiLogger.info('Add link request received', {
      method: 'GET',
      url: url,
      skipConfirm,
      category,
      tags,
      authType: authData.authType,
      tokenId: authData.tokenId,
      userId: authData.userId,
      userAgent: c.req.header('user-agent'),
      clientIp: authData.clientIp
    })

    // Extract domain
    const domain = extractDomain(url)

    // Process URL content (scrape + AI analysis)
    let processedContent
    try {
      processedContent = await processUrlContent(url, database)
    } catch (error) {
      apiLogger.warn('Unexpected error in processUrlContent, using fallback', {
        url,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
      // Use fallback content as last resort
      processedContent = await createFallbackContent(url, database)
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
    const finalTags = tags ? tags.split(',').map(t => t.trim()) : null

    // Create link record
    const now = Math.floor(Date.now() / 1000)
    
    const linkData = buildLinkData({
      url,
      domain,
      scrapedContent,
      aiAnalysis,
      aiAnalysisFailed: aiAnalysisFailed || false,
      aiError,
      skipConfirm,
      category,
      tags: finalTags,
      now
    })

    const result = await database.insert(links).values(linkData).returning({ id: links.id })
    const linkId = result[0].id

    // Log successful operation
    await logOperation(
      'link_add',
      'links',
      linkId,
      { url, skipConfirm, category, tags: finalTags },
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
        title: linkData.title || '',
        description: linkData.userDescription || linkData.aiSummary || '',
        category: linkData.userCategory || linkData.aiCategory || '',
        tags: finalTags || [],
        status: 'published',
        scrapingFailed,
        aiAnalysisFailed,
        aiError
      }

      const duration = Date.now() - startTime
      logApiRequest('GET', '/api/links/add', 200, duration)

      apiLogger.info('Add link request completed successfully (skipConfirm=true)', {
        linkId,
        url,
        duration,
        scrapingFailed,
        aiAnalysisFailed,
        status: 'published'
      })

      return c.json(response)
    } else {
      const duration = Date.now() - startTime
      logApiRequest('GET', '/api/links/add', 200, duration)

      apiLogger.info('Add link request completed successfully (redirect to confirm)', {
        linkId,
        url,
        duration,
        confirmUrl: `/confirm/${linkId}`,
        scrapingFailed,
        aiAnalysisFailed
      })

      // Return HTML processing page that will redirect to confirm page
      return c.html(generateProcessingHTML(url, linkId))
    }
  } catch (error) {
    const duration = Date.now() - startTime
    logApiRequest('GET', '/api/links/add', 500, duration)

    apiLogger.error('Add link request failed (GET)', {
      error: error instanceof Error ? error.message : String(error),
      duration,
      stack: error instanceof Error ? error.stack : undefined
    })
    return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to add link', undefined, 500)
  }
})

// POST /api/links - Add new link (authenticated)
app.post('/', requireApiTokenOrAdminSession(database), zValidator('json', addLinkBodySchema), async (c) => {
  const startTime = Date.now()

  try {
    const { url, skipConfirm, category, tags } = c.req.valid('json')
    const authData = getAuthData(c)

    // Log API request
    logApiRequest('POST', '/api/links', undefined, undefined, {
      url,
      skipConfirm,
      category,
      tags,
      authType: authData.authType,
      userAgent: c.req.header('user-agent'),
      clientIp: authData.clientIp
    })

    apiLogger.info('Add link request received', {
      method: 'POST',
      url: url,
      skipConfirm,
      category,
      tags,
      authType: authData.authType,
      tokenId: authData.tokenId,
      userId: authData.userId,
      userAgent: c.req.header('user-agent'),
      clientIp: authData.clientIp
    })

    // Extract domain
    const domain = extractDomain(url)

    // Process URL content (scrape + AI analysis)
    let processedContent
    try {
      processedContent = await processUrlContent(url, database)
    } catch (error) {
      apiLogger.warn('Unexpected error in processUrlContent, using fallback', {
        url,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
      // Use fallback content as last resort
      processedContent = await createFallbackContent(url, database)
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
    const linkData = buildLinkData({
      url,
      domain,
      scrapedContent,
      aiAnalysis,
      aiAnalysisFailed: aiAnalysisFailed || false,
      aiError,
      skipConfirm,
      category,
      tags: userTags,
      now
    })

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
        scrapingFailed: scrapingFailed || false,
        aiAnalysisFailed: aiAnalysisFailed || false,
        aiError
      }

      logApiRequest('POST', '/api/links', 200, duration)

      apiLogger.info('Add link request completed successfully (POST, skipConfirm=true)', {
        linkId,
        url,
        duration,
        scrapingFailed,
        aiAnalysisFailed,
        status: 'published'
      })

      return sendSuccess(c, responseData, 'Link added and published successfully')
    } else {
      // For browser-based usage, redirect to confirmation page
      // For API usage, this would typically return the link ID
      if (c.req.header('accept')?.includes('application/json')) {
        logApiRequest('POST', '/api/links', 200, duration)

        apiLogger.info('Add link request completed successfully (POST, API client)', {
          linkId,
          url,
          duration,
          status: 'pending',
          confirmUrl: `/confirm/${linkId}`,
          scrapingFailed,
          aiAnalysisFailed
        })

        // API client - return link ID for confirmation
        return sendSuccess(c, {
          id: linkId,
          status: 'pending',
          confirmUrl: `/confirm/${linkId}`
        }, 'Link added, awaiting confirmation')
      } else {
        logApiRequest('POST', '/api/links', 302, duration)

        apiLogger.info('Add link request completed successfully (POST, browser redirect)', {
          linkId,
          url,
          duration,
          redirectUrl: `/confirm/${linkId}`,
          scrapingFailed,
          aiAnalysisFailed
        })

        // Browser client - redirect to confirmation page
        return c.redirect(`/confirm/${linkId}`, 302)
      }
    }

  } catch (error) {
    const duration = Date.now() - startTime
    const authData = getAuthData(c)

    logApiRequest('POST', '/api/links', 500, duration)

    apiLogger.error('Add link request failed (POST)', {
      error: error instanceof Error ? error.message : String(error),
      duration,
      stack: error instanceof Error ? error.stack : undefined
    })

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

    return sendError(c, 'INTERNAL_SERVER_ERROR', 'Failed to add link', undefined, 500)
  }
})

  return app
}

// Export both the router factory and a default instance
export { createAddLinkRouter }
export default createAddLinkRouter()
