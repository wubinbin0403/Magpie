import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface AddLinkForm {
  url: string
  skipConfirm: boolean
  presetCategory: string
  presetTags: string
}

interface ProcessingStatus {
  id: string
  status: 'pending' | 'processing' | 'success' | 'failed'
  message: string
  url?: string
  title?: string
  error?: string
}

// Mock categories for the dropdown
const mockCategories = ['技术', '产品', '设计', '工具']

export default function AddLink() {
  const [form, setForm] = useState<AddLinkForm>({
    url: '',
    skipConfirm: false,
    presetCategory: '',
    presetTags: ''
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [processingItems, setProcessingItems] = useState<ProcessingStatus[]>([])

  const queryClient = useQueryClient()

  // Add link mutation
  const addLinkMutation = useMutation({
    mutationFn: async (linkData: AddLinkForm) => {
      const processingId = Date.now().toString()
      
      // Add processing item immediately
      setProcessingItems(prev => [...prev, {
        id: processingId,
        status: 'processing',
        message: '正在处理URL...',
        url: linkData.url
      }])

      try {
        // Simulate processing steps
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        setProcessingItems(prev => prev.map(item => 
          item.id === processingId 
            ? { ...item, message: '正在获取内容...', status: 'processing' }
            : item
        ))

        await new Promise(resolve => setTimeout(resolve, 1500))
        
        setProcessingItems(prev => prev.map(item => 
          item.id === processingId 
            ? { ...item, message: 'AI 正在分析...', status: 'processing' }
            : item
        ))

        await new Promise(resolve => setTimeout(resolve, 2000))

        // Mock success
        const mockTitle = linkData.url.includes('react') ? 'React 开发指南' :
                         linkData.url.includes('vue') ? 'Vue.js 实战教程' :
                         linkData.url.includes('design') ? '设计系统构建' :
                         'Web 开发最佳实践'

        setProcessingItems(prev => prev.map(item => 
          item.id === processingId 
            ? { 
                ...item, 
                status: 'success',
                message: linkData.skipConfirm ? '发布成功！' : '准备审核',
                title: mockTitle
              }
            : item
        ))

        return { success: true, id: processingId, title: mockTitle }
      } catch (error) {
        setProcessingItems(prev => prev.map(item => 
          item.id === processingId 
            ? { 
                ...item, 
                status: 'failed',
                message: '处理失败',
                error: '网络错误或无效的URL'
              }
            : item
        ))
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-links'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      // Reset form
      setForm({ url: '', skipConfirm: false, presetCategory: '', presetTags: '' })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.url.trim()) return
    
    addLinkMutation.mutate(form)
  }

  const handleBatchImport = () => {
    // TODO: Implement batch import functionality
    alert('批量导入功能即将推出！')
  }

  const clearProcessing = () => {
    setProcessingItems([])
  }

  const retryProcessing = (id: string) => {
    const item = processingItems.find(p => p.id === id)
    if (item && item.url) {
      addLinkMutation.mutate({
        url: item.url,
        skipConfirm: form.skipConfirm,
        presetCategory: form.presetCategory,
        presetTags: form.presetTags
      })
    }
  }

  const getStatusColor = (status: ProcessingStatus['status']) => {
    switch (status) {
      case 'processing': return 'text-blue-600'
      case 'success': return 'text-green-600'
      case 'failed': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: ProcessingStatus['status']) => {
    switch (status) {
      case 'processing': 
        return <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
      case 'success': 
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      case 'failed': 
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      default: 
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">添加新链接</h1>
          <p className="text-base-content/60 mt-1">添加链接用于开发和测试</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add Link Form */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-header p-6 pb-0">
            <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              添加新链接
            </h2>
          </div>
          <div className="card-body p-6 pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* URL Input */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">链接地址</span>
                </label>
                <input
                  type="url"
                  className="input input-bordered"
                  placeholder="https://example.com/article"
                  value={form.url}
                  onChange={(e) => setForm(prev => ({ ...prev, url: e.target.value }))}
                  required
                />
              </div>

              {/* Advanced Options */}
              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-2">
                  <span className="label-text font-medium">高级选项</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={showAdvanced}
                    onChange={(e) => setShowAdvanced(e.target.checked)}
                  />
                </label>
              </div>

              {showAdvanced && (
                <div className="space-y-4 p-4 bg-base-200/30 rounded-lg border border-base-300/20">
                  {/* Skip Confirm */}
                  <div className="form-control">
                    <label className="label cursor-pointer justify-start gap-3">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary"
                        checked={form.skipConfirm}
                        onChange={(e) => setForm(prev => ({ ...prev, skipConfirm: e.target.checked }))}
                      />
                      <span className="label-text">跳过确认，直接发布</span>
                    </label>
                  </div>

                  {/* Preset Category */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">预设分类（可选）</span>
                    </label>
                    <select
                      className="select select-bordered"
                      value={form.presetCategory}
                      onChange={(e) => setForm(prev => ({ ...prev, presetCategory: e.target.value }))}
                    >
                      <option value="">自动检测</option>
                      {mockCategories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>

                  {/* Preset Tags */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">预设标签（可选）</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered"
                      placeholder="react, 前端, 教程"
                      value={form.presetTags}
                      onChange={(e) => setForm(prev => ({ ...prev, presetTags: e.target.value }))}
                    />
                    <label className="label">
                      <span className="label-text-alt text-base-content/50">
                        多个标签用逗号分隔
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className={`btn btn-primary flex-1 ${addLinkMutation.isPending ? 'loading' : ''}`}
                  disabled={addLinkMutation.isPending || !form.url.trim()}
                >
                  {addLinkMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="loading loading-spinner loading-sm"></span>
                      正在处理...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      添加链接
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleBatchImport}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 8h6m-6 4h6" />
                    </svg>
                    批量导入
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Processing Status */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-header p-6 pb-0 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              处理状态
            </h2>
            {processingItems.length > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={clearProcessing}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  清空
                </span>
              </button>
            )}
          </div>
          <div className="card-body p-6 pt-4">
            {processingItems.length === 0 ? (
              <div className="text-center py-8 text-base-content/50">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 8h6m-6 4h6" />
                </svg>
                <p>还没有处理项</p>
                <p className="text-xs mt-1">添加链接以查看处理状态</p>
              </div>
            ) : (
              <div className="space-y-4">
                {processingItems.slice().reverse().map((item) => (
                  <div key={item.id} className="border border-base-300/20 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`${getStatusColor(item.status)}`}>
                          {getStatusIcon(item.status)}
                        </span>
                        <span className="text-sm font-medium">
                          {item.title || '正在处理...'}
                        </span>
                      </div>
                      {item.status === 'failed' && (
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => retryProcessing(item.id)}
                        >
                          重试
                        </button>
                      )}
                    </div>
                    
                    <div className="text-xs text-base-content/60 mb-2 truncate">
                      {item.url}
                    </div>
                    
                    <div className={`text-sm ${getStatusColor(item.status)}`}>
                      {item.message}
                    </div>
                    
                    {item.error && (
                      <div className="text-xs text-red-600 mt-1">
                        错误：{item.error}
                      </div>
                    )}
                    
                    {item.status === 'processing' && (
                      <div className="mt-2">
                        <progress className="progress progress-primary w-full h-2"></progress>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity Preview */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-header p-6 pb-0 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            最近链接
          </h2>
          <button className="btn btn-ghost btn-sm">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              查看全部
            </span>
          </button>
        </div>
        <div className="card-body p-6 pt-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center py-2">
              <span>• Tailwind CSS 4.0 发布</span>
              <div className="flex items-center gap-2">
                <span className="badge badge-outline badge-xs">技术</span>
                <span className="text-base-content/50">昨天</span>
              </div>
            </div>
            <div className="flex justify-between items-center py-2">
              <span>• 设计系统构建指南</span>
              <div className="flex items-center gap-2">
                <span className="badge badge-outline badge-xs">设计</span>
                <span className="text-base-content/50">昨天</span>
              </div>
            </div>
            <div className="flex justify-between items-center py-2">
              <span>• JavaScript 性能优化技巧</span>
              <div className="flex items-center gap-2">
                <span className="badge badge-outline badge-xs">技术</span>
                <span className="text-base-content/50">2天前</span>
              </div>
            </div>
            <div className="flex justify-between items-center py-2">
              <span>• Figma 插件开发入门</span>
              <div className="flex items-center gap-2">
                <span className="badge badge-outline badge-xs">工具</span>
                <span className="text-base-content/50">3天前</span>
              </div>
            </div>
            <div className="flex justify-between items-center py-2">
              <span>• React Server Components 实践</span>
              <div className="flex items-center gap-2">
                <span className="badge badge-outline badge-xs">技术</span>
                <span className="text-base-content/50">3天前</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}