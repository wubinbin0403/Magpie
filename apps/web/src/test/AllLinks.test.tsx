import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AllLinks from '../pages/admin/AllLinks'
import { api } from '../utils/api'
import type { AdminLinksResponse, AdminLink, SuccessResponse, CategoriesResponse } from '@magpie/shared'

// 创建类型安全的测试辅助函数
function createMockApiResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString()
  }
}

function createMockAdminLink(overrides: Partial<AdminLink> = {}): AdminLink {
  return {
    id: 1,
    url: 'https://example.com',
    title: 'Test Article',
    domain: 'example.com',
    description: 'Test description',
    category: 'Tech',
    tags: ['javascript'],
    status: 'published',
    createdAt: Date.now(),
    publishedAt: Date.now(),
    ...overrides
  }
}

// Mock the api
vi.mock('../utils/api', () => ({
  api: {
    getAllLinksAdmin: vi.fn(),
    getCategories: vi.fn(),
    updateLink: vi.fn(),
    deleteLink: vi.fn()
  }
}))

// Mock components to avoid complex dependencies
vi.mock('../components/CategoryBadge', () => ({
  default: ({ category }: { category: string }) => (
    <span data-testid="category-badge">{category}</span>
  )
}))

vi.mock('../components/TagList', () => ({
  default: ({ tags }: { tags: string[] }) => (
    <div data-testid="tag-list">
      {tags.map((tag, index) => (
        <span key={index} data-testid={`tag-${tag}`}>{tag}</span>
      ))}
    </div>
  )
}))

vi.mock('../components/LinkEditForm', () => ({
  default: ({ onSave, onCancel, isLoading }: any) => (
    <div data-testid="link-edit-form">
      <button onClick={() => onSave({ title: 'Updated Title', description: 'Updated Description', category: 'Tech', tags: ['tag1'], status: 'published' })}>
        Save
      </button>
      <button onClick={onCancel}>Cancel</button>
      {isLoading && <span>Loading...</span>}
    </div>
  )
}))

describe('AllLinks', () => {
  let queryClient: QueryClient
  
  // Mock data
  const mockAdminLinksResponse = createMockApiResponse<AdminLinksResponse>({
    links: [
      createMockAdminLink({
        id: 1,
        url: 'https://example.com/article-1',
        title: 'Test Article 1',
        domain: 'example.com',
        description: 'This is a test article description',
        category: 'Technology',
        tags: ['react', 'testing'],
        createdAt: 1640995200,
        publishedAt: 1640995300,
        readingTime: 5
      }),
      createMockAdminLink({
        id: 2,
        url: 'https://test.com/article-2',
        title: 'Test Article 2',
        domain: 'test.com',
        description: 'Another test article',
        category: 'Design',
        tags: ['ui', 'design'],
        createdAt: 1650995400,
        publishedAt: 1650995400,
      })
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1
    }
  })

  const mockCategoriesResponse = createMockApiResponse<CategoriesResponse>([
    { 
      id: 1, 
      name: 'Technology', 
      slug: 'technology',
      icon: 'code',
      displayOrder: 1,
      linkCount: 5
    },
    { 
      id: 2, 
      name: 'Design', 
      slug: 'design',
      icon: 'palette',
      displayOrder: 2,
      linkCount: 3
    },
    { 
      id: 3, 
      name: 'Business', 
      slug: 'business',
      icon: 'briefcase',
      displayOrder: 3,
      linkCount: 2
    }
  ])

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })

    // Reset mocks
    vi.clearAllMocks()
    
    // Setup default mock responses
    vi.mocked(api.getAllLinksAdmin).mockResolvedValue(mockAdminLinksResponse)
    vi.mocked(api.getCategories).mockResolvedValue(mockCategoriesResponse)
    vi.mocked(api.updateLink).mockResolvedValue(createMockApiResponse(createMockAdminLink()))
    vi.mocked(api.deleteLink).mockResolvedValue(createMockApiResponse({ success: true, message: 'Link deleted successfully' }))
  })

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    )
  }

  describe('Basic Rendering', () => {
    it('should render page title and description', async () => {
      renderWithQueryClient(<AllLinks />)
      
      await waitFor(() => {
        expect(screen.getByText('所有链接')).toBeInTheDocument()
        expect(screen.getByText('管理所有链接的状态、内容和分类')).toBeInTheDocument()
      })
    })

    it('should show total count', async () => {
      renderWithQueryClient(<AllLinks />)
      
      await waitFor(() => {
        expect(screen.getByText('共 2 个链接')).toBeInTheDocument()
      })
    })

    it('should display search input and status filter', async () => {
      renderWithQueryClient(<AllLinks />)
      
      expect(screen.getByPlaceholderText('搜索标题、描述、域名、分类或ID...')).toBeInTheDocument()
      expect(screen.getByDisplayValue('所有状态')).toBeInTheDocument()
    })
  })

  describe('Links Display', () => {
    it('should display links correctly', async () => {
      renderWithQueryClient(<AllLinks />)
      
      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument()
        expect(screen.getByText('Test Article 2')).toBeInTheDocument()
        expect(screen.getByText('https://example.com/article-1')).toBeInTheDocument()
        expect(screen.getByText('This is a test article description')).toBeInTheDocument()
      })
    })

    it('should display link IDs', async () => {
      renderWithQueryClient(<AllLinks />)
      
      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument()
        expect(screen.getByText('#2')).toBeInTheDocument()
      })
    })

    it('should display status badges', async () => {
      renderWithQueryClient(<AllLinks />)
      
      await waitFor(() => {
        expect(screen.getByText('已发布')).toBeInTheDocument()
        expect(screen.getByText('待审核')).toBeInTheDocument()
      })
    })

    it('should display category badges and tags', async () => {
      renderWithQueryClient(<AllLinks />)
      
      await waitFor(() => {
        expect(screen.getAllByTestId('category-badge')[0]).toHaveTextContent('Technology')
        expect(screen.getByTestId('tag-react')).toBeInTheDocument()
        expect(screen.getByTestId('tag-testing')).toBeInTheDocument()
      })
    })

    it('should display formatted dates', async () => {
      renderWithQueryClient(<AllLinks />)
      
      await waitFor(() => {
        expect(screen.getAllByText(/创建：2022\/01\/01/)[0]).toBeInTheDocument()
        expect(screen.getByText(/发布：2022\/01\/01/)).toBeInTheDocument()
      })
    })

    it('should display reading time when available', async () => {
      renderWithQueryClient(<AllLinks />)
      
      await waitFor(() => {
        expect(screen.getByText('5分钟')).toBeInTheDocument()
      })
    })
  })

  describe('Search and Filter', () => {
    it('should call API with search query', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<AllLinks />)
      
      const searchInput = screen.getByPlaceholderText('搜索标题、描述、域名、分类或ID...')
      await user.type(searchInput, 'react')
      
      await waitFor(() => {
        expect(api.getAllLinksAdmin).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'react'
          })
        )
      })
    })

    it('should call API with status filter', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<AllLinks />)
      
      const statusFilter = screen.getByDisplayValue('所有状态')
      await user.selectOptions(statusFilter, 'published')
      
      await waitFor(() => {
        expect(api.getAllLinksAdmin).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'published'
          })
        )
      })
    })
  })

  describe('Editing Links', () => {
    it('should show edit form when edit button is clicked', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<AllLinks />)
      
      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument()
      })
      
      const editButtons = screen.getAllByText('编辑')
      await user.click(editButtons[0])
      
      expect(screen.getByTestId('link-edit-form')).toBeInTheDocument()
    })

    it('should update link when save is clicked', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<AllLinks />)
      
      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument()
      })
      
      // Click edit button
      const editButtons = screen.getAllByText('编辑')
      await user.click(editButtons[0])
      
      // Click save in the mock form
      await user.click(screen.getByText('Save'))
      
      await waitFor(() => {
        expect(api.updateLink).toHaveBeenCalledWith(1, {
          title: 'Updated Title',
          description: 'Updated Description',
          category: 'Tech',
          tags: ['tag1'],
          status: 'published'
        })
      })
    })

    it('should cancel editing when cancel is clicked', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<AllLinks />)
      
      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument()
      })
      
      // Click edit button
      const editButtons = screen.getAllByText('编辑')
      await user.click(editButtons[0])
      
      expect(screen.getByTestId('link-edit-form')).toBeInTheDocument()
      
      // Click cancel
      await user.click(screen.getByText('Cancel'))
      
      expect(screen.queryByTestId('link-edit-form')).not.toBeInTheDocument()
    })
  })

  describe('Link Actions', () => {
    it('should show confirmation dialog when delete is clicked for non-deleted links', async () => {
      // Mock window.confirm
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      
      const user = userEvent.setup()
      renderWithQueryClient(<AllLinks />)
      
      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument()
      })
      
      const deleteButtons = screen.getAllByText('删除')
      await user.click(deleteButtons[0])
      
      expect(confirmSpy).toHaveBeenCalledWith('确定要删除链接"Test Article 1"吗？此操作不可撤销。')
      
      await waitFor(() => {
        expect(api.deleteLink).toHaveBeenCalledWith(1)
      })
      
      confirmSpy.mockRestore()
    })

    it('should not delete if confirmation is cancelled', async () => {
      // Mock window.confirm to return false
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      
      const user = userEvent.setup()
      renderWithQueryClient(<AllLinks />)
      
      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument()
      })
      
      const deleteButtons = screen.getAllByText('删除')
      await user.click(deleteButtons[0])
      
      expect(confirmSpy).toHaveBeenCalled()
      expect(api.deleteLink).not.toHaveBeenCalled()
      
      confirmSpy.mockRestore()
    })

    it('should show restore button for deleted links', async () => {
      const deletedLinkMock = {
        ...mockAdminLinksResponse,
        data: {
          ...mockAdminLinksResponse.data,
          links: [{
            ...mockAdminLinksResponse.data.links[0],
            status: 'deleted' as const
          }]
        }
      }
      
      vi.mocked(api.getAllLinksAdmin).mockResolvedValue(deletedLinkMock as any)
      
      renderWithQueryClient(<AllLinks />)
      
      await waitFor(() => {
        expect(screen.getByText('恢复')).toBeInTheDocument()
        expect(screen.queryByText('删除')).not.toBeInTheDocument()
      })
    })

    it('should restore deleted links when restore is clicked', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      
      const deletedLinkMock = {
        ...mockAdminLinksResponse,
        data: {
          ...mockAdminLinksResponse.data,
          links: [{
            ...mockAdminLinksResponse.data.links[0],
            status: 'deleted' as const
          }]
        }
      }
      
      vi.mocked(api.getAllLinksAdmin).mockResolvedValue(deletedLinkMock as any)
      
      const user = userEvent.setup()
      renderWithQueryClient(<AllLinks />)
      
      await waitFor(() => {
        expect(screen.getByText('恢复')).toBeInTheDocument()
      })
      
      await user.click(screen.getByText('恢复'))
      
      expect(confirmSpy).toHaveBeenCalledWith('确定要恢复链接"Test Article 1"吗？')
      
      await waitFor(() => {
        expect(api.updateLink).toHaveBeenCalledWith(1, { status: 'published' })
      })
      
      confirmSpy.mockRestore()
    })
  })

  describe('Loading and Error States', () => {
    it('should show loading skeletons initially', () => {
      // Mock a never-resolving promise to test loading state
      vi.mocked(api.getAllLinksAdmin).mockImplementation(() => new Promise(() => {}))
      
      renderWithQueryClient(<AllLinks />)
      
      // Should show skeleton loading elements
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('should show empty state when no links are found', async () => {
      vi.mocked(api.getAllLinksAdmin).mockResolvedValue({
        ...mockAdminLinksResponse,
        data: {
          ...mockAdminLinksResponse.data,
          links: [],
          pagination: { ...mockAdminLinksResponse.data.pagination, total: 0 }
        }
      })
      
      renderWithQueryClient(<AllLinks />)
      
      await waitFor(() => {
        expect(screen.getByText('暂无链接')).toBeInTheDocument()
        expect(screen.getByText('当前条件下没有找到任何链接，请尝试调整筛选条件或添加新链接。')).toBeInTheDocument()
      })
    })

    it('should show error state when API call fails', async () => {
      vi.mocked(api.getAllLinksAdmin).mockRejectedValue(new Error('API Error'))
      
      renderWithQueryClient(<AllLinks />)
      
      await waitFor(() => {
        expect(screen.getByText('加载失败')).toBeInTheDocument()
        expect(screen.getByText('请尝试刷新页面')).toBeInTheDocument()
      })
    })
  })

  describe('Pagination', () => {
    it('should show pagination when there are multiple pages', async () => {
      const mockWithPagination = {
        ...mockAdminLinksResponse,
        data: {
          ...mockAdminLinksResponse.data,
          pagination: {
            page: 1,
            limit: 20,
            total: 100,
            totalPages: 5
          }
        }
      }
      
      vi.mocked(api.getAllLinksAdmin).mockResolvedValue(mockWithPagination)
      
      renderWithQueryClient(<AllLinks />)
      
      await waitFor(() => {
        expect(screen.getByText('首页')).toBeInTheDocument()
        expect(screen.getByText('上一页')).toBeInTheDocument()
        expect(screen.getByText('下一页')).toBeInTheDocument()
        expect(screen.getByText('末页')).toBeInTheDocument()
      })
    })

    it('should not show pagination for single page', async () => {
      renderWithQueryClient(<AllLinks />)
      
      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument()
      })
      
      expect(screen.queryByText('首页')).not.toBeInTheDocument()
      expect(screen.queryByText('上一页')).not.toBeInTheDocument()
    })
  })

  describe('Link Interaction', () => {
    it('should open link in new tab when title is clicked', async () => {
      // Mock window.open
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
      
      const user = userEvent.setup()
      renderWithQueryClient(<AllLinks />)
      
      await waitFor(() => {
        expect(screen.getByText('Test Article 1')).toBeInTheDocument()
      })
      
      await user.click(screen.getByText('Test Article 1'))
      
      expect(openSpy).toHaveBeenCalledWith('https://example.com/article-1', '_blank')
      
      openSpy.mockRestore()
    })
  })
})