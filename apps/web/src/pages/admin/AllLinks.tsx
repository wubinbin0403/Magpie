import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../utils/api'
import { isSuccessResponse } from '../../utils/api-helpers'
import CategoryBadge from '../../components/CategoryBadge'
import TagList from '../../components/TagList'
import LinkEditForm from '../../components/LinkEditForm'
import type { ApiResponse, AdminLinksResponse, AdminLink } from '@magpie/shared'

interface EditForm {
  title: string
  description: string
  category: string
  tags: string[]
  status: 'published' | 'pending' | 'deleted'
  readingTime?: number
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
  const { data: linksData, isLoading, error } = useQuery<ApiResponse<AdminLinksResponse>>({
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
      
      return await api.getAllLinksAdmin(params)
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false
  })

  // Fetch categories for editing
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories()
  })

  const links = linksData?.success ? linksData.data.links : []
  const pagination = linksData?.success ? linksData.data.pagination : undefined
  const categories = categoriesData && isSuccessResponse(categoriesData) 
    ? categoriesData.data 
    : []

  // Update link mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<EditForm> }) => {
      const response = await api.updateLink(data.id, data.updates)
      if (!isSuccessResponse(response)) {
        throw new Error(response.error.message)
      }
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
      if (!isSuccessResponse(response)) {
        throw new Error(response.error.message)
      }
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
      status: link.status,
      readingTime: (link as any).readingTime // Type assertion until AdminLink includes readingTime
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

  const handleRestoreLink = (id: number, title: string) => {
    if (confirm(`确定要恢复链接"${title}"吗？`)) {
      updateMutation.mutate({
        id,
        updates: { status: 'published' }
      })
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

  // Format reading time: <1h shows "X分钟", >=1h shows "X小时Y分钟"
  const formatReadingTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}分钟`
    } else {
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      if (remainingMinutes === 0) {
        return `${hours}小时`
      } else {
        return `${hours}小时${remainingMinutes}分钟`
      }
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      published: { text: '已发布', class: 'bg-success text-white text-xs px-2 py-1 rounded-md' },
      pending: { text: '待审核', class: 'bg-warning text-white text-xs px-2 py-1 rounded-md' },
      deleted: { text: '已删除', class: 'bg-error text-white text-xs px-2 py-1 rounded-md' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.published
    
    return (
      <div className={`${config.class}`}>
        {config.text}
      </div>
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
      <div className="card bg-base-100">
        <div className="card-body p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="flex-1 max-w-6xl">
              <div className="form-control">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="input input-bordered flex-1 focus:border-primary"
                    placeholder="搜索标题、描述、域名、分类或ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button className="btn btn-primary btn-square">
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
                className="select select-bordered focus:border-primary"
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
        <div className="card bg-base-100">
          <div className="card-body text-center py-12">
            <div className="text-base-content/60">
              <svg className="w-20 h-20 mx-auto mb-6 text-primary/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14-7H5m14 14H5" />
              </svg>
              <h3 className="text-xl font-semibold text-base-content mb-2">暂无链接</h3>
              <p className="text-base-content/60 max-w-md mx-auto">当前条件下没有找到任何链接，请尝试调整筛选条件或添加新链接。</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {links.map((link) => (
            <div key={link.id} className={`group hover:bg-base-200/30 transition-colors duration-1000 ease-in-out -mx-4 px-4 py-4 rounded-lg ${link.status === 'deleted' ? 'opacity-60' : ''}`}>
              <div className="">
                {/* Link Header - Compact Layout */}
                <div className="flex items-start gap-3">
                  {/* ID Badge */}
                  <div className="flex-shrink-0">
                    <span className="badge badge-primary badge-outline">#{link.id}</span>
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title and Status */}
                    <div className="flex items-start justify-between gap-2 mb-1">
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
                    <div className="text-sm mb-1">
                      <a 
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary-focus hover:underline truncate block transition-colors"
                        title={link.url}
                      >
                        {link.url}
                      </a>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-base-content/80 mb-2 line-clamp-2">
                      {link.description}
                    </p>

                    {/* Category and Tags */}
                    {editingId !== link.id && (
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {link.category && <CategoryBadge category={link.category} />}
                        {link.tags.length > 0 && <TagList tags={link.tags} maxVisible={6} />}
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-xs text-base-content/60 mb-2">
                      <span>创建：{formatDate(link.createdAt)}</span>
                      {link.publishedAt && (
                        <span>发布：{formatDate(link.publishedAt)}</span>
                      )}
                      {link.readingTime && (
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          <span>{formatReadingTime(link.readingTime)}</span>
                        </div>
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
                              status: data.status,
                              readingTime: data.readingTime
                            }
                          })
                        }}
                        onCancel={handleCancelEdit}
                        isLoading={updateMutation.isPending}
                        showStatus={true}
                        compact={true}
                        className="mb-2"
                      />
                    )}

                    {/* Action Buttons */}
                    {editingId !== link.id && (
                      <div className="flex items-center gap-2">
                        <button 
                          className="btn btn-primary btn-outline btn-sm hover:btn-primary"
                          onClick={() => handleStartEdit(link)}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          编辑
                        </button>
                        {link.status === 'deleted' ? (
                          <button 
                            className="btn btn-success btn-outline btn-sm hover:btn-success"
                            onClick={() => handleRestoreLink(link.id, link.title)}
                            disabled={updateMutation.isPending}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            恢复
                          </button>
                        ) : (
                          <button 
                            className="btn btn-error btn-outline btn-sm hover:btn-error"
                            onClick={() => handleDeleteLink(link.id, link.title)}
                            disabled={deleteMutation.isPending}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            删除
                          </button>
                        )}
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
        <div className="card bg-base-100">
          <div className="card-body p-3">
            <div className="flex justify-between items-center">
              <div className="text-sm text-base-content/70">
                显示 {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, pagination.total)} 条，共 {pagination.total} 条
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="px-3 py-1 text-sm text-primary hover:text-primary-focus disabled:text-base-content/40 transition-colors"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                >
                  首页
                </button>
                <button
                  className="px-3 py-1 text-sm text-primary hover:text-primary-focus disabled:text-base-content/40 transition-colors"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                >
                  上一页
                </button>
            
            {/* Page Numbers */}
            {(() => {
              const pages = []
              const totalPages = pagination.totalPages
              const current = currentPage
              
              if (totalPages <= 7) {
                // Show all pages if 7 or fewer
                for (let i = 1; i <= totalPages; i++) {
                  pages.push(
                    <button
                      key={i}
                      className={`px-3 py-1 text-sm transition-colors ${
                        current === i 
                          ? 'text-primary underline underline-offset-2' 
                          : 'text-primary hover:text-primary-focus'
                      }`}
                      onClick={() => setCurrentPage(i)}
                    >
                      {i}
                    </button>
                  )
                }
              } else {
                // Complex pagination with ellipsis
                // Always show first page
                pages.push(
                  <button
                    key={1}
                    className={`px-3 py-1 text-sm transition-colors ${
                      current === 1 
                        ? 'text-primary underline underline-offset-2' 
                        : 'text-primary hover:text-primary-focus'
                    }`}
                    onClick={() => setCurrentPage(1)}
                  >
                    1
                  </button>
                )
                
                // Add ellipsis after first page if needed
                if (current > 4) {
                  pages.push(
                    <span key="ellipsis-start" className="px-2 py-1 text-sm text-base-content/60">
                      ...
                    </span>
                  )
                }
                
                // Show pages around current page
                const start = Math.max(2, current - 1)
                const end = Math.min(totalPages - 1, current + 1)
                
                for (let i = start; i <= end; i++) {
                  if (i !== 1 && i !== totalPages) {
                    pages.push(
                      <button
                        key={i}
                        className={`px-3 py-1 text-sm transition-colors ${
                          current === i 
                            ? 'text-primary underline underline-offset-2' 
                            : 'text-primary hover:text-primary-focus'
                        }`}
                        onClick={() => setCurrentPage(i)}
                      >
                        {i}
                      </button>
                    )
                  }
                }
                
                // Add ellipsis before last page if needed
                if (current < totalPages - 3) {
                  pages.push(
                    <span key="ellipsis-end" className="px-2 py-1 text-sm text-base-content/60">
                      ...
                    </span>
                  )
                }
                
                // Always show last page
                if (totalPages > 1) {
                  pages.push(
                    <button
                      key={totalPages}
                      className={`px-3 py-1 text-sm transition-colors ${
                        current === totalPages 
                          ? 'text-primary underline underline-offset-2' 
                          : 'text-primary hover:text-primary-focus'
                      }`}
                      onClick={() => setCurrentPage(totalPages)}
                    >
                      {totalPages}
                    </button>
                  )
                }
              }
              
              return pages
            })()}
            
                <button
                  className="px-3 py-1 text-sm text-primary hover:text-primary-focus disabled:text-base-content/40 transition-colors"
                  disabled={currentPage === pagination.totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  下一页
                </button>
                <button
                  className="px-3 py-1 text-sm text-primary hover:text-primary-focus disabled:text-base-content/40 transition-colors"
                  disabled={currentPage === pagination.totalPages}
                  onClick={() => setCurrentPage(pagination.totalPages)}
                >
                  末页
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}