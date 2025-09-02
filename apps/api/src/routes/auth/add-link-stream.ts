import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { streamSSE } from 'hono/streaming'
import { db } from '../../db/index.js'
import { links } from '../../db/schema.js'
import { sendError } from '../../utils/response.js'
import { addLinkBodySchema, extractDomain } from '../../utils/validation.js'
import { requireApiTokenOrAdminSession, logOperation } from '../../middleware/auth.js'
import { webScraper } from '../../services/web-scraper.js'
import { readabilityScraper } from '../../services/readability-scraper.js'
import { createAIAnalyzer, type AIAnalysisResult } from '../../services/ai-analyzer.js'
import { getSettings } from '../../utils/settings.js'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

// Helper function to get unified auth data
function getAuthData(c: any) {
  const authType = c.get('authType')
  const tokenData = c.get('tokenData')
  const userData = c.get('userData')
  const clientIp = c.get('clientIp')
  
  if (authType === 'api_token') {
    return {
      userId: undefined,
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
  
  return {
    userId: tokenData ? undefined : userData?.id,
    tokenId: tokenData?.id,
    clientIp,
    authType: tokenData ? 'api_token' : 'admin_session'
  }
}

// Status message types
interface StatusMessage {
  stage: 'fetching' | 'analyzing' | 'completed' | 'error'
  message: string
  progress?: number
  data?: any
  error?: string
}

// Create streaming add link router
function createAddLinkStreamRouter(database = db) {
  const app = new Hono()

  // POST /api/links/add/stream - Add link with real-time status updates
  app.post('/stream', requireApiTokenOrAdminSession(database), zValidator('json', addLinkBodySchema), async (c) => {
    const startTime = Date.now()
    const { url, skipConfirm, category, tags } = c.req.valid('json')
    const authData = getAuthData(c)
    const domain = extractDomain(url)

    return streamSSE(c, async (stream) => {
      try {
        // Send initial status
        await stream.writeSSE({
          data: JSON.stringify({
            stage: 'fetching',
            message: '正在连接到目标网站...',
            progress: 10
          } as StatusMessage)
        })

        // Step 1: Scrape web content
        let scrapedContent
        let scrapingFailed = false
        
        try {
          await stream.writeSSE({
            data: JSON.stringify({
              stage: 'fetching',
              message: '正在获取网页内容...',
              progress: 30
            } as StatusMessage)
          })

          // Try Readability scraper first, fallback to original scraper if needed
          try {
            // Using Readability scraper for better content extraction
            scrapedContent = await readabilityScraper.scrape(url)
          } catch (readabilityError) {
            try {
              // Readability scraper failed, falling back to original scraper
              scrapedContent = await webScraper.scrape(url)
            } catch (webScraperError) {
              console.warn('Both scrapers failed:', webScraperError)
              scrapingFailed = true
              
              // Create fallback content
              const domain = extractDomain(url)
              let titleFromUrl = url
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .replace(/\/$/, '')
                .replace(/[-_]/g, ' ')
              
              const pathParts = titleFromUrl.split('/').pop()
              if (pathParts && pathParts.length > 3) {
                titleFromUrl = pathParts.replace(/\.(html|php|aspx?)$/, '').replace(/[-_]/g, ' ')
              }
              
              scrapedContent = {
                url,
                title: titleFromUrl || domain,
                description: `网页内容抓取失败，请手动输入描述`,
                content: '',
                domain,
                contentType: 'article' as const,
                wordCount: 0,
                language: 'zh-CN'
              }
            }
          }

          if (scrapingFailed) {
            await stream.writeSSE({
              data: JSON.stringify({
                stage: 'fetching',
                message: '网页内容抓取失败，将使用基础信息继续',
                progress: 50,
                data: {
                  title: scrapedContent.title,
                  wordCount: scrapedContent.wordCount,
                  scrapingFailed: true
                }
              } as StatusMessage)
            })
          } else {
            await stream.writeSSE({
              data: JSON.stringify({
                stage: 'fetching',
                message: '网页内容获取成功',
                progress: 50,
                data: {
                  title: scrapedContent.title,
                  wordCount: scrapedContent.wordCount
                }
              } as StatusMessage)
            })
          }
        } catch (error) {
          // This should not happen now, but keep as final fallback
          await stream.writeSSE({
            data: JSON.stringify({
              stage: 'error',
              message: '处理过程中出现严重错误',
              error: String(error)
            } as StatusMessage)
          })
          
          await logOperation(
            'link_add',
            'links',
            undefined,
            { url, reason: 'unexpected_error', error: String(error) },
            authData.tokenId,
            authData.userId,
            authData.clientIp,
            c.req.header('user-agent'),
            'failed',
            'Unexpected error in content processing'
          )
          
          return
        }

        // Step 2: AI Analysis
        let aiAnalysis: AIAnalysisResult
        try {
          if (scrapingFailed) {
            await stream.writeSSE({
              data: JSON.stringify({
                stage: 'analyzing',
                message: '内容抓取失败，跳过AI分析',
                progress: 60
              } as StatusMessage)
            })
            
            // Use fallback analysis for failed scraping
            aiAnalysis = {
              summary: '无法自动分析内容，请手动输入描述和分类',
              category: '其他',
              tags: ['待分类'],
              language: 'zh-CN',
              sentiment: 'neutral',
              readingTime: 1
            }
            
            await stream.writeSSE({
              data: JSON.stringify({
                stage: 'analyzing',
                message: '使用基础分析，请在确认页面手动输入信息',
                progress: 80
              } as StatusMessage)
            })
          } else {
            await stream.writeSSE({
              data: JSON.stringify({
                stage: 'analyzing',
                message: '正在进行AI智能分析...',
                progress: 60
              } as StatusMessage)
            })

            const settings = await getSettings(database)
            
            if (!settings.openai_api_key) {
              // Use fallback analysis
              aiAnalysis = {
                summary: scrapedContent.description || scrapedContent.title.substring(0, 200),
                category: 'other',
                tags: ['article'],
                language: scrapedContent.language,
                sentiment: 'neutral',
                readingTime: Math.max(1, Math.ceil(scrapedContent.wordCount / 225))
              }
              
              await stream.writeSSE({
                data: JSON.stringify({
                  stage: 'analyzing',
                  message: 'AI服务未配置，使用基础分析',
                  progress: 80
                } as StatusMessage)
              })
            } else {
              const aiAnalyzer = await createAIAnalyzer(settings)
              
              await stream.writeSSE({
                data: JSON.stringify({
                  stage: 'analyzing',
                  message: '正在生成智能摘要...',
                  progress: 70
                } as StatusMessage)
              })
              
              aiAnalysis = await aiAnalyzer.analyze(scrapedContent)
              
              await stream.writeSSE({
                data: JSON.stringify({
                  stage: 'analyzing',
                  message: 'AI分析完成',
                  progress: 90,
                  data: {
                    summary: aiAnalysis.summary,
                    category: aiAnalysis.category,
                    tags: aiAnalysis.tags
                  }
                } as StatusMessage)
              })
            }
          }
        } catch (error) {
          console.warn('AI analysis failed, using basic analysis:', error)
          
          // Fallback to basic analysis
          aiAnalysis = {
            summary: scrapedContent.description || scrapedContent.title.substring(0, 200) || '请手动输入描述',
            category: 'other',
            tags: ['article'],
            language: scrapedContent.language,
            sentiment: 'neutral',
            readingTime: Math.max(1, Math.ceil(scrapedContent.wordCount / 225))
          }
          
          await stream.writeSSE({
            data: JSON.stringify({
              stage: 'analyzing',
              message: 'AI分析失败，使用基础分析',
              progress: 80
            } as StatusMessage)
          })
        }

        // Step 3: Save to database
        const now = Math.floor(Date.now() / 1000)
        const userTags = tags ? tags.split(',').map(t => t.trim()).filter(t => t.length > 0) : null

        const linkData = {
          url,
          domain,
          title: scrapedContent.title || '',
          originalDescription: scrapedContent.description || '',
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
          authData.tokenId,
          authData.userId,
          authData.clientIp,
          c.req.header('user-agent'),
          'success',
          undefined,
          duration
        )

        // Send completion status
        let completionMessage = skipConfirm ? '链接已成功发布！' : '链接已保存，等待确认'
        if (scrapingFailed && !skipConfirm) {
          completionMessage = '链接已保存，请在确认页面手动输入标题、描述和分类'
        } else if (scrapingFailed && skipConfirm) {
          completionMessage = '链接已发布，但内容抓取失败，建议稍后编辑补充信息'
        }
        
        await stream.writeSSE({
          data: JSON.stringify({
            stage: 'completed',
            message: completionMessage,
            progress: 100,
            data: {
              id: linkId,
              url,
              title: scrapedContent.title || '',
              description: linkData.finalDescription || linkData.aiSummary,
              category: linkData.finalCategory || linkData.aiCategory,
              tags: linkData.finalTags ? JSON.parse(linkData.finalTags) : aiAnalysis.tags,
              status: linkData.status,
              scrapingFailed: scrapingFailed
            }
          } as StatusMessage)
        })

      } catch (error) {
        const duration = Date.now() - startTime
        
        await stream.writeSSE({
          data: JSON.stringify({
            stage: 'error',
            message: '处理过程中出现错误',
            error: String(error)
          } as StatusMessage)
        })
        
        await logOperation(
          'link_add',
          'links',
          undefined,
          { url, error: String(error) },
          authData.tokenId,
          authData.userId,
          authData.clientIp,
          c.req.header('user-agent'),
          'failed',
          String(error),
          duration
        )
      }
    })
  })

  return app
}

// Export both the router factory and a default instance
export { createAddLinkStreamRouter }
export default createAddLinkStreamRouter()