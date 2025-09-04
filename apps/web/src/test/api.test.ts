import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api } from '../utils/api'

// Mock fetch globally
global.fetch = vi.fn()

describe('API Client', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
    // Clear localStorage
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getAllLinksAdmin', () => {
    it('should make GET request to /api/admin/links without parameters', async () => {
      const mockResponse = {
        success: true,
        data: {
          links: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
        }
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      const result = await api.getAllLinksAdmin()

      expect(fetch).toHaveBeenCalledWith('/api/admin/links', {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
      expect(result).toEqual(mockResponse)
    })

    it('should include query parameters when provided', async () => {
      const params = {
        page: '2',
        limit: '10',
        search: 'test query',
        status: 'published'
      }

      const mockResponse = {
        success: true,
        data: {
          links: [],
          pagination: { page: 2, limit: 10, total: 0, totalPages: 0 }
        }
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      await api.getAllLinksAdmin(params)

      const expectedUrl = '/api/admin/links?page=2&limit=10&search=test+query&status=published'
      expect(fetch).toHaveBeenCalledWith(expectedUrl, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
    })

    it('should include authorization header when admin token exists', async () => {
      const mockToken = 'test-admin-token'
      localStorage.setItem('admin_token', mockToken)

      const mockResponse = { success: true, data: { links: [] } }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      await api.getAllLinksAdmin()

      expect(fetch).toHaveBeenCalledWith('/api/admin/links', {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${mockToken}`
        }
      })
    })

    it('should handle search parameters with special characters', async () => {
      const params = {
        search: 'test & search = query with spaces',
        category: 'Tech & Science'
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { links: [] } })
      } as Response)

      await api.getAllLinksAdmin(params)

      const expectedUrl = '/api/admin/links?search=test+%26+search+%3D+query+with+spaces&category=Tech+%26+Science'
      expect(fetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object))
    })

    it('should handle pagination parameters correctly', async () => {
      const params = {
        page: 3,
        limit: 50
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { links: [] } })
      } as Response)

      await api.getAllLinksAdmin(params)

      const expectedUrl = '/api/admin/links?page=3&limit=50'
      expect(fetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object))
    })

    it('should handle status filter parameters', async () => {
      const testCases = [
        { status: 'published' },
        { status: 'pending' },
        { status: 'deleted' },
        { status: 'all' }
      ]

      for (const params of testCases) {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: { links: [] } })
        } as Response)

        await api.getAllLinksAdmin(params)

        const expectedUrl = `/api/admin/links?status=${params.status}`
        expect(fetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object))
      }
    })

    it('should throw error when response is not ok', async () => {
      const errorResponse = {
        error: { message: 'Access denied' }
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve(errorResponse)
      } as Response)

      await expect(api.getAllLinksAdmin()).rejects.toThrow('Access denied')
    })

    it('should handle 401 unauthorized response', async () => {
      localStorage.setItem('admin_token', 'invalid-token')
      localStorage.setItem('admin_user', 'test-user')

      // Mock window.location.href
      delete (window as any).location
      window.location = { href: '' } as any

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { message: 'Unauthorized' } })
      } as Response)

      await expect(api.getAllLinksAdmin()).rejects.toThrow('Unauthorized')

      // Check that auth data was cleared
      expect(localStorage.getItem('admin_token')).toBeNull()
      expect(localStorage.getItem('admin_user')).toBeNull()
      expect(window.location.href).toBe('/admin/login')
    })

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(api.getAllLinksAdmin()).rejects.toThrow('Network error')
    })

    it('should handle empty parameters object', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { links: [] } })
      } as Response)

      await api.getAllLinksAdmin({})

      expect(fetch).toHaveBeenCalledWith('/api/admin/links?', expect.any(Object))
    })

    it('should handle mixed parameter types', async () => {
      const params = {
        page: 1,
        search: 'test',
        active: true,
        limit: '25'
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { links: [] } })
      } as Response)

      await api.getAllLinksAdmin(params)

      const expectedUrl = '/api/admin/links?page=1&search=test&active=true&limit=25'
      expect(fetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object))
    })
  })

  describe('API Base Functionality', () => {
    it('should use correct base URL', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true })
      } as Response)

      await api.getAllLinksAdmin()

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/links'),
        expect.any(Object)
      )
    })

    it('should include correct default headers', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true })
      } as Response)

      await api.getAllLinksAdmin()

      expect(fetch).toHaveBeenCalledWith(expect.any(String), {
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        })
      })
    })
  })
})