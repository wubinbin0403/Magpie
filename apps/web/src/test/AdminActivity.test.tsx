import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AdminActivity from '../pages/admin/AdminActivity'
import type { ApiResponse, AdminActivityResponse } from '@magpie/shared'

vi.mock('../utils/api', () => ({
  __esModule: true,
  default: {
    getAdminActivity: vi.fn(),
  },
}))

import api from '../utils/api'

describe('AdminActivity', () => {
  const createQueryClient = () => new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  const renderComponent = () => {
    const queryClient = createQueryClient()

    return render(
      <QueryClientProvider client={queryClient}>
        <AdminActivity />
      </QueryClientProvider>
    )
  }

  it('renders activity logs with filters and pagination', async () => {
    const mockResponse: ApiResponse<AdminActivityResponse> = {
      success: true,
      data: {
        logs: [
          {
            id: 1,
            action: 'link_add',
            resource: 'links',
            resourceId: 101,
            status: 'success',
            details: { url: 'https://example.com', title: 'Example Link' },
            errorMessage: null,
            ip: '127.0.0.1',
            userAgent: 'Vitest',
            duration: 120,
            actor: {
              type: 'user',
              id: 1,
              name: 'Admin',
              identifier: 'admin',
            },
            createdAt: new Date().toISOString(),
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
          hasNext: false,
          hasPrev: false,
        },
        availableFilters: {
          actions: ['link_add', 'link_publish'],
          resources: ['links', 'tokens'],
          statuses: ['success', 'failed', 'pending'],
        },
      },
    }

    vi.mocked(api.getAdminActivity).mockResolvedValue(mockResponse)

    renderComponent()

    await waitFor(() => {
      expect(api.getAdminActivity).toHaveBeenCalled()
    })

    expect(await screen.findByText('所有活动')).toBeInTheDocument()
    expect(screen.getAllByText('新增链接').length).toBeGreaterThan(0)
    expect(screen.getAllByText('links').length).toBeGreaterThan(0)
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getAllByText('成功').length).toBeGreaterThan(0)

    // Filters should include provided options
    expect(screen.getByRole('option', { name: '新增链接' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'links' })).toBeInTheDocument()
  })
})
