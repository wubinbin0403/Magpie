import { describe, it, expect } from 'vitest'
import app from '../index.js'

describe('Magpie API - Basic Endpoints', () => {
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await app.request('/api/health')
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        data: {
          status: 'healthy',
          version: '1.0.0',
        }
      })
      
      expect(data.data.timestamp).toBeDefined()
      expect(data.data.node).toBeDefined()
    })
  })

  describe('Root API Endpoint', () => {
    it('should return API information', async () => {
      const response = await app.request('/api')
      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data).toEqual({
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
  })

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await app.request('/api/non-existent')
      const data = await response.json() as any

      expect(response.status).toBe(404)
      expect(data).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Route GET /api/non-existent not found',
        }
      })
      
      expect(data.timestamp).toBeDefined()
    })

    it('should handle different HTTP methods for 404', async () => {
      const response = await app.request('/api/invalid-endpoint', { method: 'POST' })
      const data = await response.json() as any

      expect(response.status).toBe(404)
      expect(data).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Route POST /api/invalid-endpoint not found',
        }
      })
    })
  })

  describe('CORS Headers', () => {
    it('should include CORS headers in responses', async () => {
      const response = await app.request('/api/health')

      expect(response.status).toBe(200)
      // Check that CORS headers are present
      expect(response.headers.get('access-control-allow-origin')).toBeDefined()
    })

    it('should handle OPTIONS preflight requests', async () => {
      const response = await app.request('/api/health', { method: 'OPTIONS' })

      expect(response.status).toBe(204) // OPTIONS requests typically return 204 No Content
      const allowMethods = response.headers.get('access-control-allow-methods')
      expect(allowMethods).toContain('GET')
      expect(allowMethods).toContain('POST')
      expect(allowMethods).toContain('PUT')
      expect(allowMethods).toContain('DELETE')
    })
  })

  describe('Response Format', () => {
    it('should return JSON content type', async () => {
      const response = await app.request('/api')

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/json')
    })

    it('should have consistent error response format', async () => {
      const response = await app.request('/api/not-found')
      const data = await response.json() as any

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('success', false)
      expect(data).toHaveProperty('error')
      expect(data.error).toHaveProperty('code')
      expect(data.error).toHaveProperty('message')
      expect(data).toHaveProperty('timestamp')
    })
  })
})