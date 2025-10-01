import type { ApiResponse } from '@magpie/shared'

const API_BASE_URL = '/api'

interface ApiOptions extends RequestInit {
  token?: string | null
}

class ApiClient {
  private getAuthToken(): string | null {
    return localStorage.getItem('admin_token')
  }

  private async request<T>(
    endpoint: string,
    options: ApiOptions = {}
  ): Promise<ApiResponse<T>> {
    const { token, headers = {}, ...restOptions } = options
    const authToken = token !== undefined ? token : this.getAuthToken()

    const config: RequestInit = {
      ...restOptions,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
        ...headers,
      },
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config)

    if (response.status === 401) {
      // Unauthorized - clear auth and redirect to login
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_user')
      window.location.href = '/admin/login'
      throw new Error('Unauthorized')
    }

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'API request failed')
    }

    return data
  }

  // Public endpoints
  async getLinks(params?: Record<string, any>): Promise<ApiResponse<import('@magpie/shared').LinksResponse>> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : ''
    return this.request<import('@magpie/shared').LinksResponse>(`/links${queryString}`)
  }

  async searchLinks(query: string, params?: Record<string, any>): Promise<ApiResponse<import('@magpie/shared').SearchResponse>> {
    const searchParams = { q: query, ...params }
    const queryString = new URLSearchParams(searchParams).toString()
    return this.request<import('@magpie/shared').SearchResponse>(`/search?${queryString}`)
  }

  async getStats(): Promise<ApiResponse<import('@magpie/shared').StatsResponse>> {
    return this.request<import('@magpie/shared').StatsResponse>('/stats')
  }

  async getDomainStats(domain: string): Promise<ApiResponse<import('@magpie/shared').DomainStatsResponse>> {
    return this.request<import('@magpie/shared').DomainStatsResponse>(`/domains/${domain}/stats`)
  }

  async getCategories(): Promise<ApiResponse<import('@magpie/shared').CategoriesResponse>> {
    return this.request<import('@magpie/shared').CategoriesResponse>('/categories')
  }

  // Admin endpoints
  async adminLogin(password: string): Promise<ApiResponse<import('@magpie/shared').AdminLoginResponse>> {
    return this.request<import('@magpie/shared').AdminLoginResponse>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
      token: null, // Don't use existing token for login
    })
  }

  async adminLogout(): Promise<ApiResponse<import('@magpie/shared').AdminLogoutResponse>> {
    return this.request<import('@magpie/shared').AdminLogoutResponse>('/admin/logout', {
      method: 'POST',
    })
  }

  async adminInit(password: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>('/admin/init', {
      method: 'POST',
      body: JSON.stringify({ password }),
      token: null, // Don't use existing token for init
    })
  }

  async getPendingLinks(params?: Record<string, any>): Promise<ApiResponse<import('@magpie/shared').LinksResponse>> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : ''
    return this.request<import('@magpie/shared').LinksResponse>(`/admin/pending${queryString}`)
  }

  // Get all links for admin (published, pending, deleted) with pagination and search
  async getAllLinksAdmin(params?: Record<string, any>): Promise<ApiResponse<import('@magpie/shared').AdminLinksResponse>> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : ''
    return this.request<import('@magpie/shared').AdminLinksResponse>(`/admin/links${queryString}`)
  }

  async getAdminActivity(params?: Record<string, any>): Promise<ApiResponse<import('@magpie/shared').AdminActivityResponse>> {
    const queryParams = params
      ? Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
          if (value === undefined || value === null) return acc
          if (Array.isArray(value)) {
            acc[key] = value.join(',')
          } else {
            acc[key] = String(value)
          }
          return acc
        }, {})
      : undefined

    const queryString = queryParams ? `?${new URLSearchParams(queryParams).toString()}` : ''
    return this.request<import('@magpie/shared').AdminActivityResponse>(`/admin/activity${queryString}`)
  }

  async batchPendingLinks(ids: number[], action: 'confirm' | 'delete' | 'reanalyze', params?: any): Promise<ApiResponse<import('@magpie/shared').BatchOperationResponse>> {
    return this.request<import('@magpie/shared').BatchOperationResponse>('/admin/pending/batch', {
      method: 'POST',
      body: JSON.stringify({ ids, action, params }),
    })
  }

  async getSettings(): Promise<ApiResponse<import('@magpie/shared').SettingsResponse>> {
    return this.request<import('@magpie/shared').SettingsResponse>('/admin/settings')
  }

  async updateSettings(settings: import('@magpie/shared').UpdateSettingsRequest): Promise<ApiResponse<import('@magpie/shared').UpdateSettingsResponse>> {
    return this.request<import('@magpie/shared').UpdateSettingsResponse>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
  }

  async testAiConnection(testConfig?: {
    apiKey: string
    baseUrl: string
    model: string
    temperature: number
    summaryPrompt?: string
    categoryPrompt?: string
  }): Promise<ApiResponse<import('@magpie/shared').AITestResponseData>> {
    return this.request<import('@magpie/shared').AITestResponseData>('/admin/settings/ai/test', {
      method: 'POST',
      body: testConfig ? JSON.stringify({ testConfig }) : undefined,
    })
  }

  async getTokens(): Promise<ApiResponse<import('@magpie/shared').TokensResponse>> {
    return this.request<import('@magpie/shared').TokensResponse>('/admin/tokens')
  }

  async createToken(name?: string, expiresAt?: string): Promise<ApiResponse<{ token: string; id: number }>> {
    return this.request<{ token: string; id: number }>('/admin/tokens', {
      method: 'POST',
      body: JSON.stringify({ name, expiresAt }),
    })
  }

  async revokeToken(tokenId: number): Promise<ApiResponse<import('@magpie/shared').DeleteTokenResponse>> {
    return this.request<import('@magpie/shared').DeleteTokenResponse>(`/admin/tokens/${tokenId}`, {
      method: 'DELETE',
    })
  }

  async createCategory(name: string, description?: string, icon?: string): Promise<ApiResponse<import('@magpie/shared').Category>> {
    return this.request<import('@magpie/shared').Category>('/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ name, description, icon }),
    })
  }

  async updateCategory(id: number, updates: { name?: string; description?: string; icon?: string }): Promise<ApiResponse<import('@magpie/shared').Category>> {
    return this.request<import('@magpie/shared').Category>(`/admin/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async deleteCategory(id: number): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>(`/admin/categories/${id}`, {
      method: 'DELETE',
    })
  }

  async reorderCategories(categoryIds: number[]): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>('/admin/categories/reorder', {
      method: 'POST',
      body: JSON.stringify({ categoryIds }),
    })
  }

  // Auth endpoints (for adding/editing links)
  async addLink(url: string, options?: { skipConfirm?: boolean; category?: string; tags?: string }): Promise<ApiResponse<import('@magpie/shared').AddLinkResponse>> {
    const params = { url, ...options }
    const queryString = new URLSearchParams(params as any).toString()
    return this.request<import('@magpie/shared').AddLinkResponse>(`/links/add?${queryString}`)
  }

  // Add link with JSON response (for frontend use)
  async addLinkJson(url: string, options?: { 
    skipConfirm?: boolean; 
    category?: string; 
    tags?: string 
  }): Promise<ApiResponse<import('@magpie/shared').AddLinkResponse>> {
    return this.request<import('@magpie/shared').AddLinkResponse>('/links', {
      method: 'POST',
      body: JSON.stringify({ 
        url, 
        skipConfirm: options?.skipConfirm || false,
        category: options?.category,
        tags: options?.tags
      }),
    })
  }


  async getPendingLink(id: number, token?: string): Promise<ApiResponse<import('@magpie/shared').PendingLinkResponse>> {
    return this.request<import('@magpie/shared').PendingLinkResponse>(`/links/${id}/pending`, token ? { token } : undefined)
  }

  async confirmLink(id: number, data: {
    title?: string
    description: string
    category: string
    tags: string[]
    readingTime?: number
    publish?: boolean
  }, token?: string): Promise<ApiResponse<import('@magpie/shared').ConfirmLinkResponse>> {
    return this.request<import('@magpie/shared').ConfirmLinkResponse>(`/links/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify(data),
      ...(token ? { token } : {}),
    })
  }

  async deleteLink(id: number): Promise<ApiResponse<import('@magpie/shared').DeleteLinkResponse>> {
    return this.request<import('@magpie/shared').DeleteLinkResponse>(`/admin/links/${id}`, {
      method: 'DELETE',
    })
  }

  async updateLink(id: number, updates: {
    title?: string
    description?: string
    category?: string
    tags?: string[]
    status?: string
  }): Promise<ApiResponse<import('@magpie/shared').AdminLink>> {
    return this.request<import('@magpie/shared').AdminLink>(`/admin/links/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }
}

export const api = new ApiClient()
export default api
