import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../utils/api'
import { isSuccessResponse } from '../../utils/api-helpers'
import CategoryBadge from '../../components/CategoryBadge'
import TagList from '../../components/TagList'
import LinkEditForm from '../../components/LinkEditForm'

interface PendingLink {
  id: number
  url: string
  title: string
  domain: string
  originalDescription: string
  aiSummary: string
  aiCategory: string
  aiTags: string | string[] // API可能返回JSON字符串或数组
  aiReadingTime?: number // AI estimated reading time in minutes
  createdAt: number // API返回的是timestamp
  status: 'pending'
  aiAnalysisFailed?: boolean
  aiError?: string
}


export default function PendingLinks() {
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    category: '',
    tags: [] as string[],
    readingTime: undefined as number | undefined
  })
  const queryClient = useQueryClient()

  // Fetch pending links
  const { data: pendingLinksResponse, isLoading, error } = useQuery({
    queryKey: ['pending-links'],
    queryFn: () => api.getPendingLinks()
  })
  
  const pendingLinksData = pendingLinksResponse && isSuccessResponse(pendingLinksResponse)
    ? pendingLinksResponse.data
    : null

  // Fetch categories for the edit form
  const { data: categoriesResponse } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories()
  })

  const categories = categoriesResponse && isSuccessResponse(categoriesResponse)
    ? categoriesResponse.data
    : []

  // Process the data to ensure proper format
  const pendingLinks: PendingLink[] = (pendingLinksData?.links || []).map((link: any) => ({
    ...link,
    aiTags: typeof link.aiTags === 'string' ? 
      (link.aiTags.trim() ? JSON.parse(link.aiTags) : []) : 
      (link.aiTags || [])
  }))

  // Confirm link mutation
  const confirmMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const response = await api.batchPendingLinks(ids, 'confirm')
      if (!isSuccessResponse(response)) {
        throw new Error(response.error.message)
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-links'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats-summary'] })
      setSelectedIds([])
    }
  })

  // Delete link mutation
  const deleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const response = await api.batchPendingLinks(ids, 'delete')
      if (!isSuccessResponse(response)) {
        throw new Error(response.error.message)
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-links'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats-summary'] })
      setSelectedIds([])
    }
  })

  // Update link mutation for editing
  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; title?: string; description: string; category: string; tags: string[]; readingTime?: number }) => {
      const response = await api.confirmLink(data.id, {
        title: data.title,
        description: data.description,
        category: data.category,
        tags: data.tags,
        readingTime: data.readingTime,
        publish: true
      })
      if (!isSuccessResponse(response)) {
        throw new Error(response.error.message)
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-links'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats-summary'] })
      setEditingId(null)
      setEditForm({ title: '', description: '', category: '', tags: [], readingTime: undefined })
    }
  })

  // Edit handlers
  const handleStartEdit = (link: PendingLink) => {
    setEditForm({
      title: link.title,
      description: link.aiSummary,
      category: link.aiCategory,
      tags: [...link.aiTags],
      readingTime: link.aiReadingTime
    })
    setEditingId(link.id)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditForm({ title: '', description: '', category: '', tags: [], readingTime: undefined })
  }



  const handleSelectAll = () => {
    if (selectedIds.length === pendingLinks.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(pendingLinks.map(link => link.id))
    }
  }

  const handleSelectOne = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id]
    )
  }

  const handleConfirm = (ids: number[]) => {
    confirmMutation.mutate(ids)
  }

  const handleDelete = (ids: number[]) => {
    if (confirm(`确定要删除 ${ids.length} 个链接吗？`)) {
      deleteMutation.mutate(ids)
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000) // Convert Unix timestamp to milliseconds
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-base-300 rounded animate-pulse"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="card bg-base-100 shadow-sm">
            <div className="card-body p-6 animate-pulse">
              <div className="h-6 bg-base-300 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-base-300 rounded w-1/2 mb-4"></div>
              <div className="h-4 bg-base-300 rounded w-full mb-2"></div>
              <div className="h-4 bg-base-300 rounded w-2/3"></div>
            </div>
          </div>
        ))}
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
          <h3 className="font-bold">加载待处理链接失败</h3>
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
          <h1 className="text-3xl font-bold text-base-content">待处理链接</h1>
          <p className="text-base-content/60 mt-1">
            {pendingLinks.length} 个链接待审核
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            className="btn btn-ghost btn-sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['pending-links'] })}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </button>
        </div>
      </div>

      {pendingLinks.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-16 h-16 mx-auto mb-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-semibold text-base-content mb-2">全部处理完毕！</h3>
          <p className="text-base-content/60">暂时没有待审核的链接。</p>
        </div>
      ) : (
        <>
          {/* Bulk Actions */}
          {selectedIds.length > 0 && (
            <div className="alert alert-info">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <span className="font-semibold">已选择 {selectedIds.length} 个链接</span>
              </div>
              <div className="flex gap-2">
                <button 
                  className={`btn btn-success btn-sm ${confirmMutation.isPending ? 'loading' : ''}`}
                  onClick={() => handleConfirm(selectedIds)}
                  disabled={confirmMutation.isPending || deleteMutation.isPending}
                >
                  {confirmMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="loading loading-spinner loading-sm"></span>
                      正在确认...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      全部确认
                    </span>
                  )}
                </button>
                <button 
                  className={`btn btn-error btn-sm ${deleteMutation.isPending ? 'loading' : ''}`}
                  onClick={() => handleDelete(selectedIds)}
                  disabled={confirmMutation.isPending || deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="loading loading-spinner loading-sm"></span>
                      正在删除...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      全部删除
                    </span>
                  )}
                </button>
                <button 
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedIds([])}
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* Select All */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={selectedIds.length === pendingLinks.length}
                onChange={handleSelectAll}
              />
              <span className="text-sm text-base-content/70">全选</span>
            </label>
            <div className="text-sm text-base-content/50">
              已选择 {selectedIds.length} / {pendingLinks.length}
            </div>
          </div>

          {/* Pending Links List - Redesigned to match HomePage style */}
          <div className="space-y-8">
            {pendingLinks.map((link) => (
              <article key={link.id} className={`bg-transparent transition-all duration-200 ${
                selectedIds.includes(link.id) ? 'opacity-75' : ''
              }`}>
                <div className="flex items-start gap-4">
                  {/* Checkbox - styled to match design */}
                  <label className="flex items-center cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-sm"
                      checked={selectedIds.includes(link.id)}
                      onChange={() => handleSelectOne(link.id)}
                    />
                  </label>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header with title and date - matching LinkCard */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <h2 
                        className="text-lg font-semibold line-clamp-2 cursor-pointer hover:underline max-w-[80%] lg:max-w-[75%]"
                        style={{ color: '#06161a' }}
                        title={link.title}
                        onClick={() => window.open(link.url, '_blank')}
                      >
                        {link.title}
                      </h2>
                      
                      {/* Date in top right */}
                      <span className="text-xs text-base-content/50 whitespace-nowrap">
                        {formatDate(link.createdAt)}
                      </span>
                    </div>
                    
                    {/* Domain and AI status - matching LinkCard meta style */}
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex items-center gap-1 text-sm" style={{ color: '#2c5766' }}>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
                        </svg>
                        {link.domain}
                      </div>

                      {/* Reading Time */}
                      {link.aiReadingTime && (
                        <div className="flex items-center gap-1 text-sm text-base-content/50">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          <span>{formatReadingTime(link.aiReadingTime)}</span>
                        </div>
                      )}
                      
                      {/* AI Status Indicator */}
                      {link.aiAnalysisFailed && (
                        <div className="flex items-center gap-1 text-xs text-orange-600">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>AI分析失败</span>
                        </div>
                      )}
                    </div>

                    {/* AI Summary - matching LinkCard description style */}
                    {link.aiSummary && (
                      <div className="text-base-content/80 text-sm leading-relaxed mb-4 line-clamp-3 max-w-[80%] lg:max-w-[75%]">
                        {link.aiSummary}
                      </div>
                    )}

                    {/* AI Error Message - if exists */}
                    {link.aiAnalysisFailed && link.aiError && (
                      <div className="text-xs text-red-600/80 mb-3 max-w-[80%] lg:max-w-[75%]">
                        错误: {link.aiError}
                      </div>
                    )}

                    {/* AI Suggestions - matching LinkCard footer style */}
                    {editingId !== link.id && (
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <CategoryBadge category={link.aiCategory} />
                        <TagList tags={Array.isArray(link.aiTags) ? link.aiTags : [link.aiTags]} maxVisible={8} />
                      </div>
                    )}

                    {/* Edit Form - shown when editing this specific link */}
                    {editingId === link.id && (
                      <LinkEditForm
                        initialData={editForm}
                        categories={categories}
                        onSave={(data) => {
                          updateMutation.mutate({
                            id: editingId,
                            title: data.title.trim(),
                            description: data.description.trim(),
                            category: data.category,
                            tags: data.tags,
                            readingTime: data.readingTime
                          })
                        }}
                        onCancel={handleCancelEdit}
                        isLoading={updateMutation.isPending}
                        saveButtonText="保存并发布"
                        compact={true}
                        className="mb-4"
                      />
                    )}

                    {/* Actions - redesigned to be more minimal, hidden when editing */}
                    {editingId !== link.id && (
                      <div className="flex items-center gap-2 flex-wrap">
                      <button 
                        className="text-sm px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-full transition-colors duration-200 flex items-center gap-1"
                        onClick={() => handleConfirm([link.id])}
                        disabled={confirmMutation.isPending}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        确认
                      </button>
                      
                      <button 
                        className="text-sm px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full transition-colors duration-200 flex items-center gap-1"
                        onClick={() => handleStartEdit(link)}
                        disabled={updateMutation.isPending}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        编辑
                      </button>
                      
                      <button 
                        className="text-sm px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-full transition-colors duration-200 flex items-center gap-1"
                        onClick={() => handleDelete([link.id])}
                        disabled={deleteMutation.isPending}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        删除
                      </button>
                      
                      <a 
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors duration-200 flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        访问
                      </a>
                    </div>
                    )}
                  </div>
                </div>
                
                {/* Subtle separator */}
                <div className="border-b border-base-content/10 mt-6"></div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  )
}