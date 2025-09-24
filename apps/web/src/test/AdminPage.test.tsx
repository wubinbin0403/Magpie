import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { ApiResponse, StatsResponse } from '@magpie/shared'
import AdminPage from '../pages/AdminPage'

vi.mock('../utils/api', () => ({
  default: {
    getStats: vi.fn(),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}))

import api from '../utils/api'

describe('AdminPage', () => {
  let queryClient: QueryClient

  const createQueryClient = () => new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createQueryClient()
  })

  afterEach(() => {
    queryClient.clear()
    cleanup()
  })

  const renderAdminPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/admin/*" element={<AdminPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('should cache the full stats API response under the shared query key', async () => {
    const mockResponse: ApiResponse<StatsResponse> = {
      success: true,
      data: {
        totalLinks: 42,
        publishedLinks: 37,
        pendingLinks: 5,
        totalCategories: 3,
        totalTags: 8,
        popularTags: [],
        popularDomains: [],
        monthlyStats: [
          { year: 2024, month: 1, count: 2 },
          { year: 2024, month: 2, count: 3 },
        ],
        recentActivity: [],
      },
      timestamp: new Date().toISOString(),
    }

    vi.mocked(api.getStats).mockResolvedValue(mockResponse)

    renderAdminPage()

    await waitFor(() => {
      expect(api.getStats).toHaveBeenCalled()
    })

    await waitFor(() => {
      const cachedValue = queryClient.getQueryData(['admin-stats-summary'])
      expect(cachedValue).toMatchObject({
        success: true,
        data: {
          pendingLinks: 5,
          totalLinks: 42,
        },
      })
    })
  })
})
