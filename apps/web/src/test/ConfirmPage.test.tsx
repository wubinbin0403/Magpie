import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ConfirmPage from '../pages/ConfirmPage'
import type { ApiResponse, PendingLinkResponse, PublicCategory, CategoriesResponse } from '@magpie/shared'

vi.mock('../utils/api', () => ({
  __esModule: true,
  default: {
    getPendingLink: vi.fn(),
    getCategories: vi.fn(),
    confirmLink: vi.fn(),
  },
}))

import api from '../utils/api'

const renderWithRouter = (initialEntry = '/confirm/123') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/confirm/:id" element={<ConfirmPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ConfirmPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('prompts for API token when none provided', () => {
    renderWithRouter()

    expect(screen.getByText('访问凭证')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('粘贴 API Token')).toBeInTheDocument()
  })

  it('loads pending link information when token is available', async () => {
    const pendingLink: PendingLinkResponse = {
      id: 123,
      url: 'https://example.com/article',
      title: 'Example Article',
      originalDescription: 'Original description',
      aiSummary: 'AI summary content',
      aiCategory: '技术',
      aiTags: ['AI', '测试'],
      domain: 'example.com',
      createdAt: Math.floor(Date.now() / 1000) - 60,
      aiAnalysisFailed: false,
      aiReadingTime: 5,
    }

    const categories: PublicCategory[] = [
      { id: 1, name: '技术', slug: 'tech', icon: 'code', description: '', displayOrder: 1, linkCount: 0 },
    ]

    vi.mocked(api.getPendingLink).mockResolvedValue({ success: true, data: pendingLink } as ApiResponse<PendingLinkResponse>)
    vi.mocked(api.getCategories).mockResolvedValue({ success: true, data: categories as CategoriesResponse } as ApiResponse<CategoriesResponse>)

    localStorage.setItem('magpie_api_token', 'token-123')

    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('链接信息')).toBeInTheDocument()
    })

    expect(screen.getByDisplayValue('Example Article')).toBeInTheDocument()
    expect(screen.getByDisplayValue('AI summary content')).toBeInTheDocument()
  })
})
