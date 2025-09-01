import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../utils/api'

interface PendingLink {
  id: number
  url: string
  title: string
  domain: string
  originalDescription: string
  aiSummary: string
  aiCategory: string
  aiTags: string | string[] // API可能返回JSON字符串或数组
  createdAt: number // API返回的是timestamp
  status: 'pending'
}


export default function PendingLinks() {
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const queryClient = useQueryClient()

  // Fetch pending links
  const { data: pendingLinksData, isLoading, error } = useQuery({
    queryKey: ['pending-links'],
    queryFn: async () => {
      const response = await api.getPendingLinks()
      return response.data
    }
  })

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
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-links'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats-summary'] })
      setSelectedIds([])
    }
  })

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

          {/* Pending Links List */}
          <div className="space-y-4">
            {pendingLinks.map((link) => (
              <div key={link.id} className={`card bg-base-100 shadow-sm hover:shadow-md transition-shadow ${
                selectedIds.includes(link.id) ? 'ring-2 ring-primary ring-opacity-50' : ''
              }`}>
                <div className="card-body p-6">
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <label className="flex items-center cursor-pointer mt-1">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary"
                        checked={selectedIds.includes(link.id)}
                        onChange={() => handleSelectOne(link.id)}
                      />
                    </label>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-base-content mb-1 truncate">
                            {link.title}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-base-content/60 mb-2">
                            <span>{link.domain}</span>
                            <span>•</span>
                            <span>{formatDate(link.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* AI Summary */}
                      <div className="mb-4">
                        <div className="text-sm text-base-content/80 leading-relaxed">
                          <strong className="text-base-content">AI 摘要：</strong> {link.aiSummary}
                        </div>
                      </div>

                      {/* AI Suggestions */}
                      <div className="flex flex-wrap items-center gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-base-content/70">分类：</span>
                          <span className="badge badge-outline">{link.aiCategory}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-base-content/70">标签：</span>
                          <div className="flex gap-1">
                            {link.aiTags.map((tag, index) => (
                              <span key={index} className="badge badge-ghost badge-sm">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button 
                          className="btn btn-success btn-sm"
                          onClick={() => handleConfirm([link.id])}
                          disabled={confirmMutation.isPending}
                        >
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            快速确认
                          </span>
                        </button>
                        <button 
                          className="btn btn-outline btn-sm"
                          onClick={() => {/* Edit functionality coming soon */}}
                        >
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            编辑
                          </span>
                        </button>
                        <button 
                          className="btn btn-error btn-outline btn-sm"
                          onClick={() => handleDelete([link.id])}
                          disabled={deleteMutation.isPending}
                        >
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            删除
                          </span>
                        </button>
                        <a 
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm"
                        >
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            访问
                          </span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}