import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { HTTPException } from 'hono/http-exception'
import * as dotenv from 'dotenv'

// Import route handlers
import linksRouter from './routes/public/links.js'
import searchRouter from './routes/public/search.js'
import statsRouter from './routes/public/stats.js'
import addLinkRouter from './routes/auth/add-link.js'
import pendingLinkRouter from './routes/auth/pending-link.js'
import confirmLinkRouter from './routes/auth/confirm-link.js'
import deleteLinkRouter from './routes/auth/delete-link.js'
import editLinkRouter from './routes/auth/edit-link.js'
import adminAuthRouter from './routes/admin/auth.js'
import adminPendingRouter from './routes/admin/pending.js'
import adminBatchRouter from './routes/admin/batch.js'

// Load environment variables
dotenv.config()

const app = new Hono()

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

// Authentication required routes
app.route('/api/links', addLinkRouter)      // POST /api/links
app.route('/api/links', pendingLinkRouter)  // GET /api/links/:id/pending
app.route('/api/links', confirmLinkRouter)  // POST /api/links/:id/confirm
app.route('/api/links', deleteLinkRouter)   // DELETE /api/links/:id
app.route('/api/links', editLinkRouter)     // PUT /api/links/:id

// Admin API routes
app.route('/api/admin', adminAuthRouter)    // POST /api/admin/login, /api/admin/init
app.route('/api/admin/pending', adminPendingRouter) // GET /api/admin/pending
app.route('/api/admin/batch', adminBatchRouter)     // POST /api/admin/batch

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

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${c.req.method} ${c.req.path} not found`,
    },
    timestamp: new Date().toISOString(),
  }, 404)
})

const port = parseInt(process.env.PORT || '3001')

console.log(`Starting Magpie API server on port ${port}`)

serve({
  fetch: app.fetch,
  port,
})

export default app