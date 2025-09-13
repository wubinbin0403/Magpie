import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { HTTPException } from 'hono/http-exception'
import { serveStatic } from '@hono/node-server/serve-static'
import * as dotenv from 'dotenv'
import { initializeDatabase } from './db/index.js'
import { logSystemStart, systemLogger } from './utils/logger.js'

// Import route handlers
import linksRouter from './routes/public/links.js'
import searchRouter from './routes/public/search.js'
import statsRouter from './routes/public/stats.js'
import domainsRouter from './routes/public/domains.js'
import publicCategoriesRouter from './routes/public/categories.js'
import addLinkRouter from './routes/auth/add-link.js'
import addLinkStreamRouter from './routes/auth/add-link-stream.js'
import pendingLinkRouter from './routes/auth/pending-link.js'
import confirmLinkRouter from './routes/auth/confirm-link.js'
import deleteLinkRouter from './routes/auth/delete-link.js'
import editLinkRouter from './routes/auth/edit-link.js'
import verifyTokenRouter from './routes/auth/verify-token.js'
import adminAuthRouter from './routes/admin/auth.js'
import adminPendingRouter from './routes/admin/pending.js'
import adminBatchRouter from './routes/admin/batch.js'
import adminSettingsRouter from './routes/admin/settings.js'
import adminTokensRouter from './routes/admin/tokens.js'
import adminCategoriesRouter from './routes/admin/categories.js'
import adminLinksRouter from './routes/admin/links.js'
import { isBot } from './utils/bot-detection.js'
import { generateBotHTML } from './utils/seo-html-generator.js'
import { db } from './db/index.js'

// Load environment variables
dotenv.config()

const app = new Hono()

// Helper function to read React app HTML in production
async function getReactAppHTML(): Promise<string> {
  try {
    const fs = await import('fs')
    const path = await import('path')
    const htmlPath = path.join(process.cwd(), '../web/dist/index.html')
    return fs.readFileSync(htmlPath, 'utf-8')
  } catch (error) {
    console.error('Failed to read React app HTML:', error)
    return '<h1>App Loading Error</h1><p>Please check server configuration.</p>'
  }
}

// Middleware
app.use('*', logger())
app.use('*', prettyJSON())
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'], // Frontend dev servers
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}))

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      node: process.version,
    }
  })
})

// Mount routes
// Public API routes
app.route('/api/links', linksRouter)
app.route('/api/search', searchRouter)
app.route('/api/stats', statsRouter)
app.route('/api/domains', domainsRouter)
app.route('/api/categories', publicCategoriesRouter)

// Authentication required routes
app.route('/api/auth', verifyTokenRouter)   // POST /api/auth/verify
app.route('/api/links', addLinkRouter)      // POST /api/links
app.route('/api/links/add', addLinkStreamRouter) // POST /api/links/add/stream - SSE endpoint
app.route('/api/links', pendingLinkRouter)  // GET /api/links/:id/pending
app.route('/api/links', confirmLinkRouter)  // POST /api/links/:id/confirm
app.route('/api/links', deleteLinkRouter)   // DELETE /api/links/:id
app.route('/api/links', editLinkRouter)     // PUT /api/links/:id

// Admin API routes
app.route('/api/admin', adminAuthRouter)    // POST /api/admin/login, /api/admin/init
app.route('/api/admin/pending', adminPendingRouter) // GET /api/admin/pending
app.route('/api/admin/pending', adminBatchRouter)   // POST /api/admin/pending/batch
app.route('/api/admin/links', adminLinksRouter)     // GET /api/admin/links
app.route('/api/admin/settings', adminSettingsRouter) // GET/PUT /api/admin/settings, POST /api/admin/settings/ai/test
app.route('/api/admin/tokens', adminTokensRouter)   // GET/POST /api/admin/tokens, DELETE /api/admin/tokens/:id
app.route('/api/admin/categories', adminCategoriesRouter) // GET/POST /api/admin/categories, PUT/DELETE /api/admin/categories/:id

// Link detail route handler
app.get('/link/:id', async (c) => {
  try {
    const userAgent = c.req.header('User-Agent') || ''
    const linkId = parseInt(c.req.param('id'))
    
    // Validate link ID
    if (isNaN(linkId) || linkId <= 0) {
      return c.html('<h1>Invalid Link ID</h1><p>The requested link ID is not valid.</p>', 400)
    }
    
    if (isBot(userAgent)) {
      // For bots/crawlers: return SEO-optimized static HTML for single link
      console.log(`Bot detected on link page: ${userAgent.substring(0, 100)}...`)
      const searchParams = new URL(c.req.url).searchParams
      const html = await generateBotHTML(db, searchParams, linkId)
      return c.html(html)
    } else {
      // For users: serve React SPA (React Router will handle client-side routing)
      if (process.env.NODE_ENV === 'production') {
        // In production: serve built React app
        return c.html(await getReactAppHTML())
      } else {
        // In development: proxy to Vite dev server
        const response = await fetch('http://localhost:3000/')
        const html = await response.text()
        return c.html(html)
      }
    }
  } catch (error) {
    console.error('Error serving link page:', error)
    return c.html('<h1>Service Temporarily Unavailable</h1><p>Please try again later.</p>', 503)
  }
})

// Category route handler
app.get('/category/:name', async (c) => {
  try {
    const userAgent = c.req.header('User-Agent') || ''
    
    if (isBot(userAgent)) {
      // For bots/crawlers: return SEO-optimized static HTML for category
      console.log(`Bot detected on category page: ${userAgent.substring(0, 100)}...`)
      const html = await generateBotHTML(db)
      return c.html(html)
    } else {
      // For users: serve React SPA (React Router will handle client-side routing)
      if (process.env.NODE_ENV === 'production') {
        // In production: serve built React app
        return c.html(await getReactAppHTML())
      } else {
        // In development: proxy to Vite dev server
        const response = await fetch('http://localhost:3000/')
        const html = await response.text()
        return c.html(html)
      }
    }
  } catch (error) {
    console.error('Error serving category page:', error)
    return c.html('<h1>Service Temporarily Unavailable</h1><p>Please try again later.</p>', 503)
  }
})

// Main route handler - SEO-optimized homepage
app.get('/', async (c) => {
  try {
    const userAgent = c.req.header('User-Agent') || ''
    
    if (isBot(userAgent)) {
      // For bots/crawlers: return SEO-optimized static HTML
      console.log(`Bot detected: ${userAgent.substring(0, 100)}...`)
      const searchParams = new URL(c.req.url).searchParams
      const html = await generateBotHTML(db, searchParams)
      return c.html(html)
    } else {
      // For users: serve React SPA
      if (process.env.NODE_ENV === 'production') {
        // In production: serve built React app
        return c.html(await getReactAppHTML())
      } else {
        // In development: proxy to Vite dev server
        const response = await fetch('http://localhost:3000/')
        const html = await response.text()
        return c.html(html)
      }
    }
  } catch (error) {
    console.error('Error serving homepage:', error)
    return c.html('<h1>Service Temporarily Unavailable</h1><p>Please try again later.</p>', 503)
  }
})

// Development mode: proxy all non-API requests to Vite dev server
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  // Proxy specific Vite dev server requests
  app.get('/@vite/client', async (c) => {
    try {
      const response = await fetch(`http://localhost:3000${c.req.path}`)
      const contentType = response.headers.get('content-type')
      const body = await response.text()
      
      return new Response(body, {
        status: response.status,
        headers: {
          'Content-Type': contentType || 'text/javascript',
        },
      })
    } catch (error) {
      return c.text('Vite dev server not available', 503)
    }
  })

  app.get('/@react-refresh', async (c) => {
    try {
      const response = await fetch(`http://localhost:3000${c.req.path}`)
      const contentType = response.headers.get('content-type')
      const body = await response.text()
      
      return new Response(body, {
        status: response.status,
        headers: {
          'Content-Type': contentType || 'text/javascript',
        },
      })
    } catch (error) {
      return c.text('Vite dev server not available', 503)
    }
  })

  // Proxy Vite filesystem requests
  app.get('/@fs/*', async (c) => {
    try {
      const response = await fetch(`http://localhost:3000${c.req.path}`)
      const contentType = response.headers.get('content-type')
      const body = await response.text()
      
      return new Response(body, {
        status: response.status,
        headers: {
          'Content-Type': contentType || 'application/javascript',
        },
      })
    } catch (error) {
      return c.text('Vite dev server not available', 503)
    }
  })

  // Proxy other Vite dev server requests
  app.get('/@*', async (c) => {
    try {
      const response = await fetch(`http://localhost:3000${c.req.path}`)
      const contentType = response.headers.get('content-type')
      const body = await response.text()
      
      return new Response(body, {
        status: response.status,
        headers: {
          'Content-Type': contentType || 'text/plain',
        },
      })
    } catch (error) {
      return c.text('Vite dev server not available', 503)
    }
  })

  app.get('/src/*', async (c) => {
    try {
      const response = await fetch(`http://localhost:3000${c.req.path}${c.req.raw.url.includes('?') ? '?' + c.req.raw.url.split('?')[1] : ''}`)
      const contentType = response.headers.get('content-type')
      const body = await response.text()
      
      return new Response(body, {
        status: response.status,
        headers: {
          'Content-Type': contentType || 'text/plain',
        },
      })
    } catch (error) {
      return c.text('Vite dev server not available', 503)
    }
  })

  // Proxy Vite deps (compiled dependencies)
  app.get('/node_modules/.vite/deps/*', async (c) => {
    try {
      const response = await fetch(`http://localhost:3000${c.req.path}${c.req.raw.url.includes('?') ? '?' + c.req.raw.url.split('?')[1] : ''}`)
      const contentType = response.headers.get('content-type')
      const body = await response.text()
      
      return new Response(body, {
        status: response.status,
        headers: {
          'Content-Type': contentType || 'application/javascript',
        },
      })
    } catch (error) {
      return c.text('Vite dev server not available', 503)
    }
  })

  // Proxy other static files to Vite dev server
  app.get('/vite.svg', async (c) => {
    try {
      const response = await fetch(`http://localhost:3000${c.req.path}`)
      const contentType = response.headers.get('content-type')
      const body = await response.arrayBuffer()
      
      return new Response(body, {
        status: response.status,
        headers: {
          'Content-Type': contentType || 'image/svg+xml',
        },
      })
    } catch (error) {
      return c.text('Vite dev server not available', 503)
    }
  })

  // Proxy magpie icon
  app.get('/magpie-icon.png', async (c) => {
    try {
      const response = await fetch(`http://localhost:3000${c.req.path}`)
      const contentType = response.headers.get('content-type')
      const body = await response.arrayBuffer()
      
      return new Response(body, {
        status: response.status,
        headers: {
          'Content-Type': contentType || 'image/png',
        },
      })
    } catch (error) {
      return c.text('Vite dev server not available', 503)
    }
  })
}

// Production mode: serve static files
if (process.env.NODE_ENV === 'production') {
  // Serve React app static assets (JS, CSS, images, etc.)
  app.get('/assets/*', serveStatic({
    root: '../web/dist'
  }))
  
  // Serve other static files (favicon, etc.)
  app.get('/magpie-icon.png', serveStatic({
    root: '../web/dist'
  }))
}

// Always serve SEO static files
if (process.env.NODE_ENV !== 'test') {
  // Serve static files (sitemap, RSS feeds)
  app.get('/sitemap.xml', serveStatic({ 
    root: './static', 
    rewriteRequestPath: (path) => path.replace('/sitemap.xml', '/sitemap.xml')
  }))
  app.get('/feed.xml', serveStatic({ 
    root: './static',
    rewriteRequestPath: (path) => path.replace('/feed.xml', '/feed.xml')
  }))
  app.get('/feed.json', serveStatic({ 
    root: './static',
    rewriteRequestPath: (path) => path.replace('/feed.json', '/feed.json')
  }))
}

// Root endpoint
app.get('/api', (c) => {
  return c.json({
    success: true,
    data: {
      name: 'Magpie API',
      version: '1.0.0',
      description: 'A lightweight link collection and display system',
      endpoints: {
        health: '/api/health',
        links: '/api/links',
        search: '/api/search',
        stats: '/api/stats',
        admin: '/api/admin',
      }
    }
  })
})

// Error handler
app.onError((err, c) => {
  console.error('API Error:', err)
  
  if (err instanceof HTTPException) {
    return c.json({
      success: false,
      error: {
        code: err.status.toString(),
        message: err.message,
      },
      timestamp: new Date().toISOString(),
    }, err.status)
  }

  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An internal server error occurred',
    },
    timestamp: new Date().toISOString(),
  }, 500)
})

// Catch-all handler for non-API routes (SPA fallback)
app.get('*', async (c) => {
  // If it's an API route, let it fall through to 404
  if (c.req.path.startsWith('/api')) {
    return c.json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
      timestamp: new Date().toISOString(),
    }, 404)
  }

  try {
    const userAgent = c.req.header('User-Agent') || ''
    
    if (isBot(userAgent)) {
      // For bots/crawlers: return SEO-optimized static HTML
      console.log(`Bot detected: ${userAgent.substring(0, 100)}...`)
      const searchParams = new URL(c.req.url).searchParams
      const html = await generateBotHTML(db, searchParams)
      return c.html(html)
    } else {
      // For users: serve React SPA
      if (process.env.NODE_ENV === 'production') {
        // In production: serve built React app
        return c.html(await getReactAppHTML())
      } else {
        // In development: proxy to Vite dev server
        const response = await fetch('http://localhost:3000/')
        const html = await response.text()
        return c.html(html)
      }
    }
  } catch (error) {
    console.error('Error serving SPA:', error)
    return c.html('<h1>Service Temporarily Unavailable</h1><p>Please try again later.</p>', 503)
  }
})

// 404 handler for API routes only
app.notFound((c) => {
  if (c.req.path.startsWith('/api')) {
    return c.json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
      timestamp: new Date().toISOString(),
    }, 404)
  }
  // Non-API routes should have been handled by catch-all above
  return c.html('<h1>Page Not Found</h1>', 404)
})

const port = parseInt(process.env.PORT || '3001')

// Initialize database before starting server
async function startServer() {
  try {
    // Initialize logging system
    logSystemStart()

    systemLogger.info('Initializing Magpie API server', {
      port: parseInt(process.env.PORT || '3001'),
      nodeEnv: process.env.NODE_ENV,
      logLevel: process.env.LOG_LEVEL || 'info'
    })

    // Initialize database (run migrations)
    await initializeDatabase()
    
    // Generate initial static files (SEO files) on startup
    if (process.env.NODE_ENV === 'production') {
      const { generateAllStaticFiles } = await import('./services/static-generator.js')
      try {
        await generateAllStaticFiles()
        console.log('✅ Initial static files generated successfully')
      } catch (error) {
        console.error('⚠️  Failed to generate initial static files:', error)
        // Don't fail server startup - static files can be regenerated later
      }
    }
    
    console.log(`Starting Magpie API server on port ${port}`)

    systemLogger.info('Starting HTTP server', { port })

    serve({
      fetch: app.fetch,
      port,
    })

    systemLogger.info('Magpie API server started successfully', {
      port,
      url: `http://localhost:${port}`,
      nodeEnv: process.env.NODE_ENV
    })

    console.log(`🚀 Server is running on http://localhost:${port}`)
  } catch (error) {
    systemLogger.error('Failed to start Magpie API server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      port,
      nodeEnv: process.env.NODE_ENV
    })

    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown handling
process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} signal received: closing database connection and shutting down gracefully`)
  
  try {
    // Close database connection
    const { closeDatabase } = await import('./db/index.js')
    closeDatabase()
    console.log('✅ Database connection closed')
  } catch (error) {
    console.error('❌ Error closing database:', error)
  }
  
  // Exit process
  process.exit(0)
}

// Start the server
startServer()

export default app