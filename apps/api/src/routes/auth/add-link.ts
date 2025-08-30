import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { db } from '../../db/index.js'
import { links } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { sendSuccess, sendError } from '../../utils/response.js'
import { addLinkBodySchema, addLinkQuerySchema, extractDomain } from '../../utils/validation.js'
import { requireApiToken, logOperation } from '../../middleware/auth.js'
import type { AddLinkResponse } from '../../types/api.js'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

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

// Placeholder for content fetching service
async function fetchPageContent(url: string): Promise<{
  title: string;
  description: string;
  content: string;
}> {
  // TODO: Implement actual web scraping with cheerio
  // For now, return mock data based on URL
  try {
    const domain = new URL(url).hostname
    
    // This would be replaced with actual web scraping
    return {
      title: `Article from ${domain}`,
      description: `Content description from ${url}`,
      content: `Mock content from ${url} - this would be the actual scraped content`
    }
  } catch (error) {
    throw new Error('Failed to fetch page content')
  }
}

// Placeholder for AI analysis service  
async function analyzeContent(title: string, content: string, url: string): Promise<{
  summary: string;
  category: string;
  tags: string[];
}> {
  // TODO: Implement actual AI API call
  // For now, return mock analysis
  try {
    const domain = new URL(url).hostname
    
    // Mock AI analysis based on URL patterns
    let category = 'general'
    let tags = ['article']
    
    if (url.includes('tech') || url.includes('programming') || url.includes('code')) {
      category = 'technology'
      tags = ['tech', 'programming']
    } else if (url.includes('design') || url.includes('ui')) {
      category = 'design'
      tags = ['design', 'ui']
    } else if (url.includes('news')) {
      category = 'news'
      tags = ['news', 'current-events']
    }
    
    return {
      summary: `AI-generated summary: ${title.substring(0, 100)}...`,
      category,
      tags
    }
  } catch (error) {
    // Fallback analysis
    return {
      summary: title.substring(0, 100) + (title.length > 100 ? '...' : ''),
      category: 'general',
      tags: ['article']
    }
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
app.get('/add', requireApiToken(database), zValidator('query', addLinkQuerySchema, (result, c) => {
  if (!result.success) {
    return sendError(c, 'VALIDATION_ERROR', 'Invalid request parameters', undefined, 400)
  }
}), async (c) => {
  const startTime = Date.now()
  
  try {
    const { url, skipConfirm, category, tags } = c.req.valid('query')
    const tokenData = c.get('tokenData')
    const clientIp = c.get('clientIp')

    // Extract domain
    const domain = extractDomain(url)

    // Check if URL already exists
    const existingLink = await database
      .select({ id: links.id })
      .from(links)
      .where(eq(links.url, url))
      .limit(1)

    if (existingLink.length > 0) {
      await logOperation(
        'link_add',
        'links',
        existingLink[0].id,
        { url, reason: 'duplicate' },
        tokenData?.id,
        undefined,
        clientIp,
        c.req.header('user-agent'),
        'failed',
        'URL already exists'
      )
      
      return sendError(c, 'DUPLICATE_URL', 'URL already exists', { 
        id: existingLink[0].id 
      }, 409)
    }

    // Fetch content from URL
    let pageContent
    try {
      pageContent = await fetchPageContent(url)
    } catch (error) {
      await logOperation(
        'link_add',
        'links',
        undefined,
        { url, reason: 'fetch_failed', error: String(error) },
        tokenData?.id,
        undefined,
        clientIp,
        c.req.header('user-agent'),
        'failed',
        'Failed to fetch page content'
      )
      
      return sendError(c, 'NETWORK_ERROR', 'Failed to fetch page content', undefined, 500)
    }

    // Analyze content with AI
    let aiAnalysis
    try {
      aiAnalysis = await analyzeContent(pageContent.title, pageContent.content, url)
    } catch (error) {
      await logOperation(
        'link_add',
        'links',
        undefined,
        { url, reason: 'ai_failed', error: String(error) },
        tokenData?.id,
        undefined,
        clientIp,
        c.req.header('user-agent'),
        'failed',
        'AI analysis failed'
      )
      
      return sendError(c, 'AI_SERVICE_ERROR', 'AI analysis failed', undefined, 500)
    }

    // Create final data
    const finalCategory = category || aiAnalysis.category
    const finalTags = tags ? tags.split(',').map(t => t.trim()) : aiAnalysis.tags
    const finalDescription = aiAnalysis.summary

    // Create link record
    const now = Math.floor(Date.now() / 1000)
    const searchText = `${pageContent.title} ${finalDescription} ${finalCategory} ${finalTags.join(' ')}`.toLowerCase()
    
    const linkData = {
      url,
      domain,
      title: pageContent.title,
      originalDescription: pageContent.description,
      originalContent: pageContent.content,
      aiSummary: aiAnalysis.summary,
      aiCategory: aiAnalysis.category,
      aiTags: JSON.stringify(aiAnalysis.tags),
      finalDescription,
      finalCategory,
      finalTags: JSON.stringify(finalTags),
      status: skipConfirm ? 'published' as const : 'pending' as const,
      createdAt: now,
      publishedAt: skipConfirm ? now : undefined,
      searchText,
    }

    const result = await database.insert(links).values(linkData).returning({ id: links.id })
    const linkId = result[0].id

    // Log successful operation
    await logOperation(
      'link_add',
      'links',
      linkId,
      { url, skipConfirm, finalCategory, finalTags },
      tokenData?.id,
      undefined,
      clientIp,
      c.req.header('user-agent'),
      'success',
      undefined,
      Date.now() - startTime
    )

    if (skipConfirm) {
      // Return JSON for API calls
      const response: AddLinkResponse = {
        success: true,
        data: {
          id: linkId,
          url,
          title: pageContent.title,
          description: finalDescription,
          category: finalCategory,
          tags: finalTags,
          status: 'published',
        }
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
app.post('/', requireApiToken(database), zValidator('json', addLinkBodySchema), async (c) => {
  const startTime = Date.now()
  
  try {
    const { url, skipConfirm, category, tags } = c.req.valid('json')
    const tokenData = c.get('tokenData')
    const clientIp = c.get('clientIp')

    // Extract domain
    const domain = extractDomain(url)

    // Check if URL already exists
    const existingLink = await database
      .select({ id: links.id })
      .from(links)
      .where(eq(links.url, url))
      .limit(1)

    if (existingLink.length > 0) {
      await logOperation(
        'link_add',
        'links',
        existingLink[0].id,
        { url, reason: 'duplicate' },
        tokenData?.id,
        undefined,
        clientIp,
        c.req.header('user-agent'),
        'failed',
        'URL already exists'
      )
      
      return sendError(c, 'DUPLICATE_URL', 'URL already exists', { 
        id: existingLink[0].id 
      }, 409)
    }

    // Fetch content from URL
    let pageContent
    try {
      pageContent = await fetchPageContent(url)
    } catch (error) {
      await logOperation(
        'link_add',
        'links',
        undefined,
        { url, reason: 'fetch_failed', error: String(error) },
        tokenData?.id,
        undefined,
        clientIp,
        c.req.header('user-agent'),
        'failed',
        'Failed to fetch content'
      )
      
      return sendError(c, 'FETCH_ERROR', 'Failed to fetch content from URL', undefined, 400)
    }

    // Get AI analysis
    let aiAnalysis
    try {
      aiAnalysis = await analyzeContent(pageContent.title, pageContent.content, url)
    } catch (error) {
      console.warn('AI analysis failed, using fallback:', error)
      // Use fallback analysis
      aiAnalysis = {
        summary: pageContent.description || pageContent.title.substring(0, 100),
        category: 'general',
        tags: ['article']
      }
    }

    const now = Math.floor(Date.now() / 1000)

    // Parse user-provided tags
    const userTags = tags ? tags.split(',').map(t => t.trim()).filter(t => t.length > 0) : null

    // Create link record
    const linkData = {
      url,
      domain,
      title: pageContent.title || '',
      originalDescription: pageContent.description || '',
      originalContent: pageContent.content || '',
      aiSummary: aiAnalysis.summary,
      aiCategory: aiAnalysis.category,
      aiTags: JSON.stringify(aiAnalysis.tags),
      userDescription: null,
      userCategory: category || null,
      userTags: userTags ? JSON.stringify(userTags) : null,
      finalDescription: null,
      finalCategory: null,
      finalTags: null,
      status: skipConfirm ? 'published' : 'pending',
      publishedAt: skipConfirm ? now : null,
      createdAt: now,
      updatedAt: now
    }

    // If skipConfirm is true, set final values immediately
    if (skipConfirm) {
      linkData.finalDescription = linkData.userDescription || linkData.aiSummary
      linkData.finalCategory = linkData.userCategory || linkData.aiCategory  
      linkData.finalTags = linkData.userTags || linkData.aiTags
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
      tokenData?.id,
      undefined,
      clientIp,
      c.req.header('user-agent'),
      'success',
      undefined,
      duration
    )

    if (skipConfirm) {
      // Return published link data
      const responseData: AddLinkResponse = {
        id: linkId,
        url,
        title: pageContent.title || '',
        description: linkData.finalDescription!,
        category: linkData.finalCategory!,
        tags: JSON.parse(linkData.finalTags!),
        status: 'published'
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
    const tokenData = c.get('tokenData')
    const clientIp = c.get('clientIp')
    
    await logOperation(
      'link_add',
      'links',
      undefined,
      { error: String(error) },
      tokenData?.id,
      undefined,
      clientIp,
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