import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import ApiTokens from '../pages/admin/ApiTokens'
import api from '../utils/api'
import { isSuccessResponse } from '../utils/api-helpers'

// Mock API module
vi.mock('../utils/api', () => ({
  default: {
    getTokens: vi.fn(),
    createToken: vi.fn(),
    revokeToken: vi.fn(),
  }
}))

// Mock API helpers
vi.mock('../utils/api-helpers', () => ({
  isSuccessResponse: vi.fn()
}))

// Mock ConfirmDialog component 
vi.mock('../components/admin/ConfirmDialog', () => ({
  default: ({ isOpen, onConfirm, onCancel, title, message }: any) => (
    isOpen ? (
      <div data-testid="confirm-dialog">
        <h3>{title}</h3>
        <p>{message}</p>
        <button onClick={onConfirm}>确认</button>
        <button onClick={onCancel}>取消</button>
      </div>
    ) : null
  )
}))

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
})

describe('ApiTokens', () => {
  let queryClient: QueryClient
  const user = userEvent.setup()

  // Sample test data
  const mockTokensResponse = {
    success: true as const,
    data: {
      tokens: [
        {
          id: 1,
          token: 'mgp_***f456',
          name: 'Test Token',
          prefix: 'mgp_',
          status: 'active' as const,
          usageCount: 5,
          lastUsedAt: 1672531200, // 2023-01-01
          lastUsedIp: '192.168.1.1',
          createdAt: 1672444800, // 2022-12-31
        },
        {
          id: 2,
          token: 'mgp_***w012',
          name: 'Mobile App Token',
          prefix: 'mgp_',
          status: 'revoked' as const,
          usageCount: 12,
          lastUsedAt: 1672617600,
          lastUsedIp: '10.0.0.1',
          createdAt: 1672358400,
          revokedAt: 1672704000,
        }
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 2,
        pages: 1,
        hasNext: false,
        hasPrev: false,
      }
    }
  }

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ApiTokens />
      </QueryClientProvider>
    )
  }

  describe('Basic Rendering', () => {
    it('should render page title and description', async () => {
      vi.mocked(api.getTokens).mockResolvedValue(mockTokensResponse)
      vi.mocked(isSuccessResponse).mockReturnValue(true)

      renderComponent()

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /API Token 管理/i })).toBeInTheDocument()
      })
      expect(screen.getByText('创建和管理用于外部API访问的令牌')).toBeInTheDocument()
    })

    it('should display loading state initially', () => {
      vi.mocked(api.getTokens).mockImplementation(() => new Promise(() => {})) // Never resolves
      vi.mocked(isSuccessResponse).mockReturnValue(true)

      renderComponent()

      // Loading states should be visible
      expect(document.querySelectorAll('.animate-pulse')).toHaveLength(4) // Header + 3 cards
    })

    it('should display error state when API fails', async () => {
      vi.mocked(api.getTokens).mockRejectedValue(new Error('API Error'))

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('加载 Token 列表失败')).toBeInTheDocument()
      })
    })
  })

  describe('Token Display', () => {
    beforeEach(() => {
      vi.mocked(api.getTokens).mockResolvedValue(mockTokensResponse)
      vi.mocked(isSuccessResponse).mockReturnValue(true)
    })

    it('should display active and revoked token sections', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('活跃的 Token')).toBeInTheDocument()
        expect(screen.getByText('已撤销的 Token')).toBeInTheDocument()
      })

      // Check token counts
      expect(screen.getByText('活跃: 1 | 已撤销: 1')).toBeInTheDocument()
    })

    it('should display token information correctly', async () => {
      renderComponent()

      await waitFor(() => {
        // Active token
        expect(screen.getByText('Test Token')).toBeInTheDocument()
        expect(screen.getByText('mgp_***f456')).toBeInTheDocument()
        expect(screen.getByText('192.168.1.1')).toBeInTheDocument()
        
        // Revoked token
        expect(screen.getByText('Mobile App Token')).toBeInTheDocument()
        expect(screen.getByText('mgp_***w012')).toBeInTheDocument()
      })
    })

    it('should show empty state when no active tokens exist', async () => {
      const emptyResponse = {
        ...mockTokensResponse,
        success: true as const,
        data: {
          ...mockTokensResponse.data,
          tokens: mockTokensResponse.data.tokens.filter(t => t.status !== 'active')
        }
      }
      vi.mocked(api.getTokens).mockResolvedValue(emptyResponse)

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('暂无活跃的 Token')).toBeInTheDocument()
        expect(screen.getByText('创建第一个 API Token 来开始使用')).toBeInTheDocument()
      })
    })
  })

  describe('Create Token', () => {
    beforeEach(() => {
      vi.mocked(api.getTokens).mockResolvedValue(mockTokensResponse)
      vi.mocked(isSuccessResponse)
        .mockReturnValueOnce(true) // for initial getTokens call
        .mockReturnValueOnce(true) // for createToken call
    })

    it('should create token with name', async () => {
      const newTokenResponse = {
        success: true as const,
        data: {
          id: 3,
          token: 'mgp_newtoken123456789',
        }
      }
      vi.mocked(api.createToken).mockResolvedValue(newTokenResponse)

      renderComponent()

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument()
      })

      // Enter token name
      const nameInput = screen.getByPlaceholderText('例如：移动端应用、Chrome扩展等')
      await user.type(nameInput, 'New Test Token')

      // Click create button
      const createButton = screen.getByRole('button', { name: /创建 Token/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(api.createToken).toHaveBeenCalledWith('New Test Token')
      })
    })

    it('should create token without name', async () => {
      const newTokenResponse = {
        success: true as const,
        data: {
          id: 3,
          token: 'mgp_newtoken123456789',
        }
      }
      vi.mocked(api.createToken).mockResolvedValue(newTokenResponse)
      vi.mocked(isSuccessResponse)
        .mockReturnValueOnce(true) // for initial getTokens call
        .mockReturnValueOnce(true) // for createToken call

      renderComponent()

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument()
      })

      // Click create button without entering name
      const createButton = screen.getByRole('button', { name: /创建 Token/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(api.createToken).toHaveBeenCalledWith(undefined)
      })
    })

    it('should display newly created token', async () => {
      const newTokenResponse = {
        success: true as const,
        data: {
          id: 3,
          token: 'mgp_newtoken123456789',
        }
      }
      vi.mocked(api.createToken).mockResolvedValue(newTokenResponse)
      vi.mocked(isSuccessResponse)
        .mockReturnValueOnce(true) // for initial getTokens call
        .mockReturnValueOnce(true) // for createToken call

      renderComponent()

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument()
      })

      const createButton = screen.getByRole('button', { name: /创建 Token/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(screen.getByText('新 Token 创建成功！')).toBeInTheDocument()
        expect(screen.getByText('mgp_newtoken123456789')).toBeInTheDocument()
      })
    })
  })

  describe('Token Actions', () => {
    beforeEach(() => {
      vi.mocked(api.getTokens).mockResolvedValue(mockTokensResponse)
      vi.mocked(isSuccessResponse).mockReturnValue(true)
    })

    it('should display masked tokens without copy buttons', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('mgp_***f456')).toBeInTheDocument()
      })

      // Should not have copy buttons for masked tokens
      expect(screen.queryByText('复制')).not.toBeInTheDocument()
    })

    it('should open revoke confirmation dialog', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '撤销' })).toBeInTheDocument()
      })

      const revokeButton = screen.getByRole('button', { name: '撤销' })
      await user.click(revokeButton)

      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
        expect(screen.getByText('撤销 Token')).toBeInTheDocument()
        expect(screen.getByText(/确定要撤销 Token "Test Token"/)).toBeInTheDocument()
      })
    })

    it('should revoke token after confirmation', async () => {
      const revokeResponse = {
        success: true as const,
        data: { id: 1, status: 'revoked' }
      }
      vi.mocked(api.revokeToken).mockResolvedValue(revokeResponse)

      renderComponent()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '撤销' })).toBeInTheDocument()
      })

      // Open confirmation dialog
      const revokeButton = screen.getByRole('button', { name: '撤销' })
      await user.click(revokeButton)

      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
      })

      // Confirm revocation
      const confirmButton = screen.getByRole('button', { name: '确认' })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(api.revokeToken).toHaveBeenCalledWith(1)
      })
    })

    it('should cancel token revocation', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '撤销' })).toBeInTheDocument()
      })

      // Open confirmation dialog
      const revokeButton = screen.getByRole('button', { name: '撤销' })
      await user.click(revokeButton)

      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
      })

      // Cancel revocation
      const cancelButton = screen.getByRole('button', { name: '取消' })
      await user.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
      })

      expect(api.revokeToken).not.toHaveBeenCalled()
    })
  })

  describe('Token Formatting', () => {
    beforeEach(() => {
      vi.mocked(api.getTokens).mockResolvedValue(mockTokensResponse)
      vi.mocked(isSuccessResponse).mockReturnValue(true)
    })

    it('should format dates correctly', async () => {
      renderComponent()

      await waitFor(() => {
        // Check if date formatting appears (Chinese locale)
        expect(screen.getAllByText(/2023/)).toHaveLength(2) // Should have 2 dates with 2023
        expect(screen.getAllByText(/2022/).length).toBeGreaterThan(0) // Should have at least 1 date with 2022
      })
    })

    it('should show "从未使用" for unused tokens', async () => {
      const unusedTokenResponse = {
        ...mockTokensResponse,
        success: true as const,
        data: {
          ...mockTokensResponse.data,
          tokens: [{
            ...mockTokensResponse.data.tokens[0],
            lastUsedAt: undefined,
            lastUsedIp: undefined,
            usageCount: 0
          }]
        }
      }
      vi.mocked(api.getTokens).mockResolvedValue(unusedTokenResponse)

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('从未使用')).toBeInTheDocument()
      })
    })

    it('should display "未命名" for tokens without names', async () => {
      const unnamedTokenResponse = {
        ...mockTokensResponse,
        success: true as const,
        data: {
          ...mockTokensResponse.data,
          tokens: [{
            ...mockTokensResponse.data.tokens[0],
            name: undefined
          }]
        }
      }
      vi.mocked(api.getTokens).mockResolvedValue(unnamedTokenResponse)

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('未命名')).toBeInTheDocument()
      })
    })
  })

  describe('Usage Information', () => {
    beforeEach(() => {
      vi.mocked(api.getTokens).mockResolvedValue(mockTokensResponse)
      vi.mocked(isSuccessResponse).mockReturnValue(true)
    })

    it('should display usage instructions', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('API Token 使用说明')).toBeInTheDocument()
        expect(screen.getByText(/Authorization: Bearer mgp_your_token/)).toBeInTheDocument()
        expect(screen.getByText(/Token 只在创建时显示一次/)).toBeInTheDocument()
        expect(screen.getByText(/撤销后的 Token 将立即失效/)).toBeInTheDocument()
      })
    })
  })

  describe('Auto-hide New Token Alert', () => {
    it('should show newly created token alert with close button', async () => {
      const newTokenResponse = {
        success: true as const,
        data: {
          id: 3,
          token: 'mgp_newtoken123456789',
        }
      }
      vi.mocked(api.getTokens).mockResolvedValue(mockTokensResponse)
      vi.mocked(api.createToken).mockResolvedValue(newTokenResponse)
      vi.mocked(isSuccessResponse)
        .mockReturnValueOnce(true) // for initial getTokens call
        .mockReturnValueOnce(true) // for createToken call

      renderComponent()

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument()
      })

      // Create token
      const createButton = screen.getByRole('button', { name: /创建 Token/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(screen.getByText('新 Token 创建成功！')).toBeInTheDocument()
        expect(screen.getByText('mgp_newtoken123456789')).toBeInTheDocument()
      })

      // Should have close button
      const closeButton = screen.getByText('✕')
      expect(closeButton).toBeInTheDocument()

      // Click close button
      await user.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByText('新 Token 创建成功！')).not.toBeInTheDocument()
      })
    })
  })
})