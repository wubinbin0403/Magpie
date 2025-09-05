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
  ): Promise<T> {
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
  async getLinks(params?: Record<string, any>) {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : ''
    return this.request(`/links${queryString}`)
  }

  async searchLinks(query: string, params?: Record<string, any>) {
    const searchParams = { q: query, ...params }
    const queryString = new URLSearchParams(searchParams).toString()
    return this.request(`/search?${queryString}`)
  }

  async getStats() {
    return this.request('/stats')
  }

  async getDomainStats(domain: string) {
    return this.request(`/domains/${domain}/stats`)
  }

  async getCategories() {
    return this.request('/categories')
  }

  // Admin endpoints
  async adminLogin(password: string) {
    return this.request('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
      token: null, // Don't use existing token for login
    })
  }

  async adminLogout() {
    return this.request('/admin/logout', {
      method: 'POST',
    })
  }

  async adminInit(password: string) {
    return this.request('/admin/init', {
      method: 'POST',
      body: JSON.stringify({ password }),
      token: null, // Don't use existing token for init
    })
  }

  async getPendingLinks(params?: Record<string, any>) {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : ''
    return this.request(`/admin/pending${queryString}`)
  }

  // Get all links for admin (published, pending, deleted) with pagination and search
  async getAllLinksAdmin(params?: Record<string, any>) {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : ''
    return this.request(`/admin/links${queryString}`)
  }

  async batchPendingLinks(ids: number[], action: 'confirm' | 'delete' | 'reanalyze', params?: any) {
    return this.request('/admin/pending/batch', {
      method: 'POST',
      body: JSON.stringify({ ids, action, params }),
    })
  }

  async getSettings() {
    return this.request('/admin/settings')
  }

  async updateSettings(settings: any) {
    return this.request('/admin/settings', {
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
  }) {
    return this.request('/admin/settings/ai/test', {
      method: 'POST',
      body: testConfig ? JSON.stringify({ testConfig }) : undefined,
    })
  }

  async getTokens() {
    return this.request('/admin/tokens')
  }

  async createToken(name?: string, expiresAt?: string) {
    return this.request('/admin/tokens', {
      method: 'POST',
      body: JSON.stringify({ name, expiresAt }),
    })
  }

  async revokeToken(tokenId: number) {
    return this.request(`/admin/tokens/${tokenId}`, {
      method: 'DELETE',
    })
  }

  async createCategory(name: string, description?: string, icon?: string) {
    return this.request('/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ name, description, icon }),
    })
  }

  async updateCategory(id: number, updates: { name?: string; description?: string; icon?: string }) {
    return this.request(`/admin/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async deleteCategory(id: number) {
    return this.request(`/admin/categories/${id}`, {
      method: 'DELETE',
    })
  }

  async reorderCategories(categoryIds: number[]) {
    return this.request('/admin/categories/reorder', {
      method: 'POST',
      body: JSON.stringify({ categoryIds }),
    })
  }

  // Auth endpoints (for adding/editing links)
  async addLink(url: string, options?: { skipConfirm?: boolean; category?: string; tags?: string }) {
    const params = { url, ...options }
    const queryString = new URLSearchParams(params as any).toString()
    return this.request(`/links/add?${queryString}`)
  }

  // Add link with JSON response (for frontend use)
  async addLinkJson(url: string, options?: { 
    skipConfirm?: boolean; 
    category?: string; 
    tags?: string 
  }) {
    return this.request('/links', {
      method: 'POST',
      body: JSON.stringify({ 
        url, 
        skipConfirm: options?.skipConfirm || false,
        category: options?.category,
        tags: options?.tags
      }),
    })
  }


  async getPendingLink(id: number) {
    return this.request(`/links/${id}/pending`)
  }

  async confirmLink(id: number, data: {
    title?: string
    description: string
    category: string
    tags: string[]
    readingTime?: number
    publish?: boolean
  }) {
    return this.request(`/links/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deleteLink(id: number) {
    return this.request(`/admin/links/${id}`, {
      method: 'DELETE',
    })
  }

  async updateLink(id: number, updates: {
    title?: string
    description?: string
    category?: string
    tags?: string[]
    status?: string
  }) {
    return this.request(`/admin/links/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }
}

export const api = new ApiClient()
export default api