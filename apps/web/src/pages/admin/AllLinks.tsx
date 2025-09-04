import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../utils/api'
import CategoryBadge from '../../components/CategoryBadge'
import TagList from '../../components/TagList'
import LinkEditForm from '../../components/LinkEditForm'

interface AdminLink {
  id: number
  url: string
  title: string
  domain: string
  description: string
  category: string
  tags: string[]
  status: 'published' | 'pending' | 'deleted'
  createdAt: number
  publishedAt?: number
  readingTime?: number
}

interface AdminLinksResponse {
  success: boolean
  data: {
    links: AdminLink[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
    filters?: {
      categories: any[]
      tags: string[]
    }
  }
}

interface EditForm {
  title: string
  description: string
  category: string
  tags: string[]
  status: 'published' | 'pending' | 'deleted'
}

export default function AllLinks() {
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'pending' | 'deleted'>('all')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    title: '',
    description: '',
    category: '',
    tags: [],
    status: 'published'
  })
  
  const queryClient = useQueryClient()
  const pageSize = 20

  // Fetch all links with pagination and filters
  const { data: linksData, isLoading, error } = useQuery<AdminLinksResponse>({
    queryKey: ['admin-all-links', currentPage, searchQuery, statusFilter],
    queryFn: async () => {
      const params: any = {
        page: currentPage,
        limit: pageSize
      }
      
      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }
      
      if (statusFilter !== 'all') {
        params.status = statusFilter
      }
      
      const response = await api.getAllLinksAdmin(params)
      return response.data
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false
  })

  // Fetch categories for editing
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.getCategories()
      return response.data
    }
  })

  const links = linksData?.data.links || []
  const pagination = linksData?.data.pagination
  const categories = categoriesData || []

  // Update link mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<EditForm> }) => {
      const response = await api.updateLink(data.id, data.updates)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-links'] })
      setEditingId(null)
      setEditForm({ title: '', description: '', category: '', tags: [], status: 'published' })
    }
  })

  // Delete link mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.deleteLink(id)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-links'] })
    }
  })

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1) // Reset to first page on search
    }, 300)
    
    return () => clearTimeout(timer)
  }, [searchQuery, statusFilter])

  // Edit handlers
  const handleStartEdit = (link: AdminLink) => {
    setEditForm({
      title: link.title,
      description: link.description,
      category: link.category,
      tags: [...link.tags],
      status: link.status
    })
    setEditingId(link.id)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditForm({ title: '', description: '', category: '', tags: [], status: 'published' })
  }

  const handleDeleteLink = (id: number, title: string) => {
    if (confirm(`确定要删除链接"${title}"吗？此操作不可撤销。`)) {
      deleteMutation.mutate(id)
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      published: { text: '已发布', class: 'badge-success' },
      pending: { text: '待审核', class: 'badge-warning' },
      deleted: { text: '已删除', class: 'badge-error' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.published
    
    return (
      <span className={`badge badge-sm ${config.class}`}>
        {config.text}
      </span>
    )
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h3 className="font-bold">加载失败</h3>
          <div className="text-xs">请尝试刷新页面</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">所有链接</h1>
          <p className="text-base-content/60 mt-1">
            管理所有链接的状态、内容和分类
          </p>
        </div>
        <div className="text-sm text-base-content/60">
          共 {pagination?.total || 0} 个链接
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1">
              <div className="form-control">
                <div className="input-group">
                  <input
                    type="text"
                    className="input input-bordered input-sm flex-1"
                    placeholder="搜索标题、描述、域名、分类或ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button className="btn btn-square btn-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Status Filter */}
            <div className="form-control">
              <select
                className="select select-bordered select-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">所有状态</option>
                <option value="published">已发布</option>
                <option value="pending">待审核</option>
                <option value="deleted">已删除</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Links List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card bg-base-100 shadow-sm">
              <div className="card-body p-6 animate-pulse">
                <div className="h-4 bg-base-300 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-base-300 rounded w-1/2 mb-4"></div>
                <div className="h-3 bg-base-300 rounded w-full mb-2"></div>
                <div className="h-3 bg-base-300 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : links.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-base-content/60">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14-7H5m14 14H5" />
            </svg>
            <p className="text-lg font-medium mb-1">暂无链接</p>
            <p className="text-sm">当前条件下没有找到任何链接</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {links.map((link) => (
            <div key={link.id} className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="card-body p-4">
                {/* Link Header - Compact Layout */}
                <div className="flex items-start gap-4">
                  {/* ID Badge */}
                  <div className="flex-shrink-0">
                    <span className="badge badge-neutral badge-sm">#{link.id}</span>
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title and Status */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 
                        className="font-semibold text-base leading-tight line-clamp-2 cursor-pointer hover:underline"
                        onClick={() => window.open(link.url, '_blank')}
                        title={link.title}
                      >
                        {link.title}
                      </h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getStatusBadge(link.status)}
                      </div>
                    </div>

                    {/* URL */}
                    <div className="text-sm text-primary mb-2">
                      <a 
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:underline truncate block"
                        title={link.url}
                      >
                        {link.url}
                      </a>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-base-content/80 mb-3 line-clamp-2">
                      {link.description}
                    </p>

                    {/* Category and Tags */}
                    {editingId !== link.id && (
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {link.category && <CategoryBadge category={link.category} />}
                        {link.tags.length > 0 && <TagList tags={link.tags} maxVisible={6} />}
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-xs text-base-content/60 mb-3">
                      <span>创建：{formatDate(link.createdAt)}</span>
                      {link.publishedAt && (
                        <span>发布：{formatDate(link.publishedAt)}</span>
                      )}
                      {link.readingTime && (
                        <span>阅读时长：{link.readingTime}分钟</span>
                      )}
                    </div>

                    {/* Edit Form */}
                    {editingId === link.id && (
                      <LinkEditForm
                        initialData={editForm}
                        categories={categories}
                        onSave={(data) => {
                          updateMutation.mutate({
                            id: editingId,
                            updates: {
                              title: data.title.trim(),
                              description: data.description.trim(),
                              category: data.category,
                              tags: data.tags,
                              status: data.status
                            }
                          })
                        }}
                        onCancel={handleCancelEdit}
                        isLoading={updateMutation.isPending}
                        showStatus={true}
                        compact={true}
                        className="mb-3"
                      />
                    )}

                    {/* Action Buttons */}
                    {editingId !== link.id && (
                      <div className="flex items-center gap-2">
                        <button 
                          className="btn btn-outline btn-sm"
                          onClick={() => handleStartEdit(link)}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          编辑
                        </button>
                        <button 
                          className="btn btn-error btn-outline btn-sm"
                          onClick={() => handleDeleteLink(link.id, link.title)}
                          disabled={deleteMutation.isPending}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center">
          <div className="join">
            <button
              className="join-item btn btn-sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
            >
              首页
            </button>
            <button
              className="join-item btn btn-sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
            >
              上一页
            </button>
            
            {/* Page Numbers */}
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(
                pagination.totalPages - 4,
                currentPage - 2
              )) + i
              
              if (pageNum > pagination.totalPages) return null
              
              return (
                <button
                  key={pageNum}
                  className={`join-item btn btn-sm ${currentPage === pageNum ? 'btn-active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              )
            })}
            
            <button
              className="join-item btn btn-sm"
              disabled={currentPage === pagination.totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              下一页
            </button>
            <button
              className="join-item btn btn-sm"
              disabled={currentPage === pagination.totalPages}
              onClick={() => setCurrentPage(pagination.totalPages)}
            >
              末页
            </button>
          </div>
        </div>
      )}
    </div>
  )
}