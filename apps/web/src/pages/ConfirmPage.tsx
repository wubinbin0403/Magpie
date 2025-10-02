import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import { isSuccessResponse } from '../utils/api-helpers'
import type { PendingLinkResponse, ConfirmLinkResponse } from '@magpie/shared'
import CategoryBadge from '../components/CategoryBadge'
import TagList from '../components/TagList'

const TOKEN_STORAGE_KEY = 'magpie_api_token'

function useQueryToken() {
  const location = useLocation()

  return useMemo(() => {
    const params = new URLSearchParams(location.search)
    const token = params.get('token')
    return token ? token.trim() : null
  }, [location.search])
}

function formatTimestamp(unixSeconds?: number) {
  if (!unixSeconds) return '未知'
  const date = new Date(unixSeconds * 1000)
  if (Number.isNaN(date.getTime())) return '未知'
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatRelativeTime(unixSeconds?: number) {
  if (!unixSeconds) return ''
  const diff = Date.now() - unixSeconds * 1000
  if (diff < 0) return ''
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

function maskToken(token: string) {
  const trimmed = token.trim()
  if (trimmed.length <= 10) {
    return `${trimmed.slice(0, 4)}****`
  }
  const prefix = trimmed.slice(0, 6)
  const suffix = trimmed.slice(-4)
  const maskedLength = Math.max(4, trimmed.length - prefix.length - suffix.length)
  const limitedMask = Math.min(maskedLength, 8)
  return `${prefix}${'*'.repeat(limitedMask)}${suffix}`
}

export default function ConfirmPage() {
  const { id: idParam } = useParams<{ id: string }>()
  const queryToken = useQueryToken()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const parsedId = idParam ? Number.parseInt(idParam, 10) : NaN

  const [storedToken, setStoredToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  })
  const [tokenInput, setTokenInput] = useState('')
  const [activeToken, setActiveToken] = useState<string | null>(() => {
    return queryToken || localStorage.getItem(TOKEN_STORAGE_KEY)
  })
  const [allowQuery, setAllowQuery] = useState(true)
  const [formState, setFormState] = useState({
    title: '',
    description: '',
    category: '',
    tags: '',
    readingTime: '',
  })
  const [publishMode, setPublishMode] = useState<'publish' | 'draft'>('publish')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [flowState, setFlowState] = useState<'idle' | 'draft-saved' | 'published'>('idle')
  const [lastPendingLink, setLastPendingLink] = useState<PendingLinkResponse | null>(null)

  useEffect(() => {
    if (queryToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, queryToken)
      setStoredToken(queryToken)
      setActiveToken(queryToken)
    }
  }, [queryToken])

  const hasValidId = Number.isFinite(parsedId) && parsedId > 0

  const pendingLinkQuery = useQuery({
    queryKey: ['confirm-link', parsedId, activeToken],
    enabled: hasValidId && Boolean(activeToken) && allowQuery,
    retry: false,
    queryFn: async () => {
      if (!activeToken) throw new Error('缺少 API Token')
      const response = await api.getPendingLink(parsedId, activeToken)
      if (!isSuccessResponse(response)) {
        throw new Error(response.error.message)
      }
      return response.data as PendingLinkResponse
    }
  })

  const categoriesQuery = useQuery({
    queryKey: ['public-categories'],
    queryFn: async () => {
      const response = await api.getCategories()
      if (!isSuccessResponse(response)) {
        throw new Error(response.error.message)
      }
      return response.data
    }
  })

  const categories = useMemo(
    () => categoriesQuery.data?.map(category => category.name) ?? [],
    [categoriesQuery.data]
  )

  useEffect(() => {
    if (pendingLinkQuery.data) {
      const link = pendingLinkQuery.data
      const userTags = link.userTags ?? []
      const aiTags = link.aiTags ?? []
      setLastPendingLink(link)
      setFormState({
        title: link.title || '',
        description: link.userDescription || link.aiSummary || link.originalDescription || '',
        category: link.userCategory || link.aiCategory || '',
        tags: (userTags.length > 0 ? userTags : aiTags).join(', '),
        readingTime: link.aiReadingTime ? String(link.aiReadingTime) : ''
      })
      setPublishMode('publish')
      setStatusMessage(null)
    }
  }, [pendingLinkQuery.data])

  const tokenToDisplay = activeToken || storedToken || null
  const [categoryMode, setCategoryMode] = useState<'select' | 'custom'>('select')
  const maskedToken = tokenToDisplay ? maskToken(tokenToDisplay) : null

  useEffect(() => {
    if (!pendingLinkQuery.data) return
    const link = pendingLinkQuery.data
    const initialCategory = link.userCategory || link.aiCategory || ''

    if (!initialCategory) {
      setCategoryMode('select')
      return
    }

    if (categories.includes(initialCategory)) {
      setCategoryMode('select')
    } else {
      setCategoryMode('custom')
    }
  }, [pendingLinkQuery.data, categories])

  const saveToken = () => {
    const trimmed = tokenInput.trim()
    if (!trimmed) {
      setStatusMessage('请输入有效的 API Token')
      return
    }
    localStorage.setItem(TOKEN_STORAGE_KEY, trimmed)
    setStoredToken(trimmed)
    setActiveToken(trimmed)
    setTokenInput('')
    setStatusMessage('Token 已保存，可开始加载待确认的链接。')
  }

  const clearToken = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setStoredToken(null)
    setActiveToken(null)
    setTokenInput('')
    setStatusMessage('Token 已清除，请重新输入有效的 API Token。')
    queryClient.removeQueries({ queryKey: ['confirm-link'] })
  }

  const confirmMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      if (!activeToken) {
        throw new Error('缺少 API Token，请先在页面上输入。')
      }

      if (!hasValidId) {
        throw new Error('无效的链接 ID。')
      }

      if (!formState.title.trim()) {
        throw new Error('请填写标题。')
      }

      if (!formState.description.trim()) {
        throw new Error('请填写描述。')
      }

      const readingTimeValue = formState.readingTime.trim()
      let readingTime: number | undefined
      if (readingTimeValue) {
        const parsedReadingTime = Number(readingTimeValue)
        if (Number.isNaN(parsedReadingTime) || parsedReadingTime <= 0) {
          throw new Error('阅读时间需要为正数。')
        }
        readingTime = parsedReadingTime
      }

      const tags = formState.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)

      const payload = {
        title: formState.title.trim(),
        description: formState.description.trim(),
        category: formState.category.trim(),
        tags,
        readingTime,
        publish
      }

      const response = await api.confirmLink(parsedId, payload, activeToken)
      if (!isSuccessResponse(response)) {
        throw new Error(response.error.message)
      }
      return response.data as ConfirmLinkResponse
    },
    onSuccess: (_data, publish) => {
      if (publish) {
        setFlowState('published')
        setStatusMessage(null)
        setAllowQuery(false)
        queryClient.invalidateQueries({ queryKey: ['links'] })
      } else {
        setFlowState('draft-saved')
        setStatusMessage('链接已保存为草稿。')
        pendingLinkQuery.refetch()
      }
    },
    onError: (error) => {
      setStatusMessage(error instanceof Error ? error.message : '操作失败')
    }
  })

  const handlePublish = () => {
    setPublishMode('publish')
    confirmMutation.mutate(true)
  }

  const handleSaveDraft = () => {
    setPublishMode('draft')
    confirmMutation.mutate(false)
  }

  const pendingLink = pendingLinkQuery.data
  const isTokenMissing = !activeToken
  const isLoading = pendingLinkQuery.isLoading || pendingLinkQuery.isFetching
  const loadError = pendingLinkQuery.error as Error | undefined

  const handleCategorySelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    if (value === '__custom__') {
      setCategoryMode('custom')
      return
    }
    setCategoryMode('select')
    setFormState(prev => ({ ...prev, category: value }))
  }

  const handleCustomCategoryChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setFormState(prev => ({ ...prev, category: value }))
  }

  const selectedCategoryValue = categoryMode === 'custom'
    ? '__custom__'
    : formState.category && categories.includes(formState.category)
      ? formState.category
      : ''

  const displayLink = pendingLinkQuery.data ?? lastPendingLink

  if (flowState === 'published') {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center px-4">
        <div className="max-w-xl w-full">
          <div className="card bg-base-100 shadow-lg border border-success/30">
            <div className="card-body items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-success/10 text-success flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-base-content">链接已成功发布 🎉</h1>
                {displayLink && (
                  <p className="text-base-content/70 text-sm break-words">
                    {displayLink.title || displayLink.url}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    try {
                      window.close()
                    } catch (error) {
                      console.warn('Manual close failed:', error)
                    }
                  }}
                >
                  关闭此页面
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => navigate('/')}
                >
                  返回首页
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base-100">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-base-content">确认链接</h1>
          <p className="text-base-content/70">核对 AI 建议后的内容并发布链接。需要有效的 API Token 才能加载待确认的数据。</p>
        </div>

            <div className="card bg-base-100 shadow-sm border border-base-300/20">
              <div className="card-body space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="card-title text-base-content">访问凭证</h2>
                    <p className="text-sm text-base-content/60">使用拥有该链接权限的 API Token，才能继续编辑和发布。</p>
                  </div>
                  {maskedToken ? (
                    <div className="flex items-center gap-2 rounded-full border border-base-300/40 bg-base-200/40 px-3 py-1 text-xs text-base-content/70">
                      <span className="font-medium text-base-content">已保存 Token</span>
                      <span className="font-mono">{maskedToken}</span>
                    </div>
                  ) : null}
                </div>

                {statusMessage && (
                  <div className="alert alert-info">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 18a9 9 0 110-18 9 9 0 010 18z" />
                </svg>
                <span>{statusMessage}</span>
              </div>
            )}

            <div className="flex flex-col gap-3 md:flex-row">
              <input
                type="password"
                className="input input-bordered flex-1"
                placeholder={maskedToken ? `已保存 Token：${maskedToken}，如需替换请粘贴新的 Token` : '粘贴 API Token'}
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                autoComplete="off"
              />
              <div className="flex gap-2">
                <button
                  className="btn btn-primary"
                  onClick={saveToken}
                >
                  保存 Token
                </button>
                {tokenToDisplay && (
                  <button
                    className="btn btn-ghost"
                    onClick={clearToken}
                  >
                    清除
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-base-content/50">
              如果通过浏览器插件添加链接，插件会自动带上 Token。手动访问时可以在上方保存 Token，后续页面会自动使用。
            </p>
          </div>
        </div>

        {!hasValidId && (
          <div className="alert alert-error">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>无效的链接 ID。</span>
          </div>
        )}

        {hasValidId && !isTokenMissing && loadError && (
          <div className="alert alert-error">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-bold">加载待确认链接失败</h3>
              <div className="text-sm">{loadError.message || '请检查 Token 是否正确或链接是否仍处于待确认状态。'}</div>
            </div>
          </div>
        )}

        {hasValidId && !isTokenMissing && isLoading && (
          <div className="card bg-base-100 shadow-sm border border-base-300/20">
            <div className="card-body animate-pulse space-y-4">
              <div className="h-6 bg-base-300/60 rounded" />
              <div className="h-4 bg-base-200/60 rounded w-3/4" />
              <div className="h-4 bg-base-200/60 rounded w-1/2" />
              <div className="h-24 bg-base-200/60 rounded" />
            </div>
          </div>
        )}

        {hasValidId && !isTokenMissing && !isLoading && pendingLink && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="card bg-base-100 shadow-sm border border-base-300/20">
                <div className="card-body space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="card-title text-base-content">链接信息</h3>
                      <p className="text-xs text-base-content/60">确认以下信息后再发布到公开页面。</p>
                    </div>
                    <span className="badge badge-warning">待确认</span>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-base-content">目标链接：</span>
                      <a
                        href={pendingLink.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link link-primary break-all"
                      >
                        {pendingLink.url}
                      </a>
                    </div>
                    <div className="flex flex-wrap gap-4 text-base-content/70 text-xs">
                      <span>域名：{pendingLink.domain || '未知'}</span>
                      <span>提交时间：{formatTimestamp(pendingLink.createdAt)}（{formatRelativeTime(pendingLink.createdAt)}）</span>
                      {pendingLink.aiReadingTime ? <span>AI 预估阅读 {pendingLink.aiReadingTime} 分钟</span> : null}
                    </div>
                  </div>

                  {pendingLink.aiSummary && (
                    <div className="bg-base-200/40 border border-base-300/20 rounded-lg p-3 space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-base-content">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 18a9 9 0 110-18 9 9 0 010 18z" />
                        </svg>
                        <span className="font-medium">AI 摘要建议</span>
                      </div>
                      <p className="text-base-content/70 whitespace-pre-wrap leading-relaxed">{pendingLink.aiSummary}</p>
                      <div className="space-y-2 text-xs text-base-content/60">
                        {pendingLink.aiCategory && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-base-content/80">分类</span>
                            <CategoryBadge
                              category={pendingLink.aiCategory}
                              className="pointer-events-none cursor-default"
                            />
                          </div>
                        )}
                        {(pendingLink.aiTags ?? []).length > 0 && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-base-content/80">标签</span>
                            <TagList
                              tags={pendingLink.aiTags ?? []}
                              maxVisible={pendingLink.aiTags?.length ?? 0}
                              className="pointer-events-none cursor-default"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {pendingLink.originalDescription && (
                    <div className="bg-base-200/40 border border-base-300/20 rounded-lg p-3 space-y-1 text-sm">
                      <div className="font-medium text-base-content">抓取到的原始描述</div>
                      <p className="text-base-content/60 whitespace-pre-wrap leading-relaxed">{pendingLink.originalDescription}</p>
                    </div>
                  )}

                  {pendingLink.aiAnalysisFailed && pendingLink.aiError && (
                    <div className="alert alert-warning text-xs">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>AI 分析失败：{pendingLink.aiError}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-sm border border-base-300/20">
              <div className="card-body space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="card-title text-base-content">内容编辑</h3>
                  <span className="badge badge-outline">链接 ID：{pendingLink.id}</span>
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text">标题 *</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={formState.title}
                    onChange={(event) => setFormState(prev => ({ ...prev, title: event.target.value }))}
                    placeholder="请输入链接标题"
                  />
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text">描述 *</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered h-28"
                    value={formState.description}
                    onChange={(event) => setFormState(prev => ({ ...prev, description: event.target.value }))}
                    placeholder="总结链接内容，方便展示于主页"
                  />
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text">分类</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={selectedCategoryValue}
                    onChange={handleCategorySelectChange}
                    disabled={categoriesQuery.isLoading}
                  >
                    <option value="">选择分类</option>
                    {categories.map((category) => (
                      <option value={category} key={category}>
                        {category}
                      </option>
                    ))}
                    <option value="__custom__">自定义分类...</option>
                  </select>
                  {categoryMode === 'custom' && (
                    <input
                      type="text"
                      className="input input-bordered mt-2"
                      value={formState.category}
                      onChange={handleCustomCategoryChange}
                      placeholder="输入或创建新的分类"
                    />
                  )}
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text">标签</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={formState.tags}
                    onChange={(event) => setFormState(prev => ({ ...prev, tags: event.target.value }))}
                    placeholder="多个标签使用逗号分隔"
                  />
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text">预估阅读时间（分钟）</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input input-bordered"
                    value={formState.readingTime}
                    onChange={(event) => setFormState(prev => ({ ...prev, readingTime: event.target.value }))}
                    placeholder="例如：5"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className={`btn btn-primary ${publishMode === 'publish' && confirmMutation.isPending ? 'loading' : ''}`}
                      onClick={handlePublish}
                      disabled={confirmMutation.isPending}
                    >
                      {publishMode === 'publish' && confirmMutation.isPending ? '正在发布...' : '确认发布'}
                    </button>
                    <button
                      className={`btn btn-outline ${publishMode === 'draft' && confirmMutation.isPending ? 'loading' : ''}`}
                      onClick={handleSaveDraft}
                      disabled={confirmMutation.isPending}
                    >
                      {publishMode === 'draft' && confirmMutation.isPending ? '保存中...' : '保存为草稿'}
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => navigate('/')}
                      type="button"
                    >
                      返回首页
                    </button>
                  </div>
                  <p className="text-xs text-base-content/50">草稿不会公开展示，可在后台的待处理或所有链接列表中继续编辑。</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
