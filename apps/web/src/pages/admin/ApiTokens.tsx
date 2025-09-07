import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../utils/api'
import { isSuccessResponse } from '../../utils/api-helpers'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import type { ApiToken } from '@magpie/shared'

export default function ApiTokens() {
  const [newTokenName, setNewTokenName] = useState('')
  const [isCreatingToken, setIsCreatingToken] = useState(false)
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    token: ApiToken | null
  }>({
    isOpen: false,
    token: null
  })
  
  const queryClient = useQueryClient()

  // Fetch tokens
  const { data: tokensData, isLoading, error } = useQuery({
    queryKey: ['admin-tokens'],
    queryFn: async () => {
      const response = await api.getTokens()
      return isSuccessResponse(response) ? response.data : null
    }
  })

  // Create token mutation
  const createTokenMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await api.createToken(name.trim() || undefined)
      return isSuccessResponse(response) ? response.data : null
    },
    onSuccess: (data) => {
      if (data) {
        setNewlyCreatedToken(data.token)
        queryClient.invalidateQueries({ queryKey: ['admin-tokens'] })
        showToast('API Token 创建成功！请复制并妥善保存', 'success')
      }
    },
    onError: (error) => {
      console.error('Failed to create token:', error)
      showToast('创建 Token 失败', 'error')
    },
    onSettled: () => {
      setIsCreatingToken(false)
      setNewTokenName('')
    }
  })

  // Revoke token mutation
  const revokeTokenMutation = useMutation({
    mutationFn: async (tokenId: number) => {
      const response = await api.revokeToken(tokenId)
      return isSuccessResponse(response) ? response.data : null
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tokens'] })
      showToast('Token 已成功撤销', 'success')
    },
    onError: (error) => {
      console.error('Failed to revoke token:', error)
      showToast('撤销 Token 失败', 'error')
    }
  })

  // Helper function for showing toasts
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const toast = document.createElement('div')
    toast.className = 'fixed top-24 left-1/2 transform -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-top-4 duration-300'
    
    const iconSvg = type === 'success' 
      ? '<svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
      : '<svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>'
    
    const bgColor = type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
    
    toast.innerHTML = `
      <div class="flex items-center gap-3 px-4 py-3 ${bgColor} border rounded-xl shadow-lg backdrop-blur-sm max-w-md">
        <div class="flex-shrink-0">
          ${iconSvg}
        </div>
        <span class="font-medium text-sm">${message}</span>
      </div>
    `
    document.body.appendChild(toast)
    
    // Auto remove after 3 seconds with fade out
    setTimeout(() => {
      if (document.body.contains(toast)) {
        toast.className += ' animate-out fade-out slide-out-to-top-4 duration-300'
        setTimeout(() => {
          if (document.body.contains(toast)) {
            document.body.removeChild(toast)
          }
        }, 300)
      }
    }, 3000)
  }, [])

  const handleCreateToken = useCallback(() => {
    if (createTokenMutation.isPending) return
    setIsCreatingToken(true)
    createTokenMutation.mutate(newTokenName)
  }, [createTokenMutation, newTokenName])

  const handleRevokeToken = useCallback((token: ApiToken) => {
    setConfirmDialog({
      isOpen: true,
      token
    })
  }, [])

  const handleConfirmRevoke = useCallback(() => {
    if (confirmDialog.token) {
      revokeTokenMutation.mutate(confirmDialog.token.id)
      setConfirmDialog({
        isOpen: false,
        token: null
      })
    }
  }, [confirmDialog.token, revokeTokenMutation])

  const handleCancelRevoke = useCallback(() => {
    setConfirmDialog({
      isOpen: false,
      token: null
    })
  }, [])

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Token 已复制到剪贴板', 'success')
    }).catch(() => {
      showToast('复制失败，请手动复制', 'error')
    })
  }, [showToast])

  const formatDate = useCallback((timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN')
  }, [])

  // Auto-hide newly created token after 30 seconds
  useEffect(() => {
    if (newlyCreatedToken) {
      const timer = setTimeout(() => {
        setNewlyCreatedToken(null)
      }, 30000)
      return () => clearTimeout(timer)
    }
  }, [newlyCreatedToken])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-base-300 rounded animate-pulse"></div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card bg-base-100 shadow-sm">
            <div className="card-body p-6 animate-pulse">
              <div className="h-6 bg-base-300 rounded w-1/3 mb-4"></div>
              <div className="space-y-3">
                <div className="h-10 bg-base-300 rounded"></div>
                <div className="h-10 bg-base-300 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-base-content">API Token 管理</h1>
            <p className="text-base-content/60 mt-1">管理API访问令牌</p>
          </div>
        </div>
        <div className="alert alert-error">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span>加载 Token 列表失败</span>
        </div>
      </div>
    )
  }

  const tokens = tokensData?.tokens || []
  const activeTokens = tokens.filter(t => t.status === 'active')
  const revokedTokens = tokens.filter(t => t.status === 'revoked')

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">API Token 管理</h1>
          <p className="text-base-content/60 mt-1">创建和管理用于外部API访问的令牌</p>
        </div>
        <div className="text-sm text-base-content/60">
          活跃: {activeTokens.length} | 已撤销: {revokedTokens.length}
        </div>
      </div>

      {/* Newly Created Token Alert */}
      {newlyCreatedToken && (
        <div className="alert alert-success">
          <div className="flex items-start gap-3 w-full">
            <svg className="w-6 h-6 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="font-bold">新 Token 创建成功！</h3>
              <div className="text-sm mt-1">
                请立即复制并妥善保存此 Token，出于安全考虑将不会再次显示完整内容。
              </div>
              <div className="flex items-center gap-2 mt-3 p-3 bg-base-100/50 rounded-lg">
                <code className="flex-1 text-sm font-mono break-all">{newlyCreatedToken}</code>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => copyToClipboard(newlyCreatedToken)}
                >
                  复制
                </button>
              </div>
            </div>
            <button
              className="btn btn-sm btn-circle btn-ghost"
              onClick={() => setNewlyCreatedToken(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Create Token Form */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-header p-4 pb-0">
          <h2 className="text-lg font-semibold text-base-content flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            创建新 Token
          </h2>
        </div>
        <div className="card-body p-4 pt-2">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="form-control flex-1">
              <label className="label">
                <span className="label-text font-medium">Token 名称（可选）</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder="例如：移动端应用、Chrome扩展等"
                disabled={isCreatingToken || createTokenMutation.isPending}
              />
              <label className="label">
                <span className="label-text-alt text-base-content/50">
                  便于识别和管理不同用途的 Token
                </span>
              </label>
            </div>
            <div className="form-control flex-shrink-0">
              <label className="label">
                <span className="label-text">&nbsp;</span>
              </label>
              <button
                className={`btn btn-primary ${createTokenMutation.isPending ? 'loading' : ''}`}
                onClick={handleCreateToken}
                disabled={isCreatingToken || createTokenMutation.isPending}
              >
                {createTokenMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="loading loading-spinner loading-sm"></span>
                    创建中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    创建 Token
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Active Tokens */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-header p-4 pb-0">
          <h2 className="text-lg font-semibold text-base-content flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            活跃的 Token
            <span className="badge badge-success badge-sm">{activeTokens.length}</span>
          </h2>
        </div>
        <div className="card-body p-4 pt-2">
          {activeTokens.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-base-content/20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 className="text-lg font-medium text-base-content/60 mb-2">暂无活跃的 Token</h3>
              <p className="text-base-content/50">创建第一个 API Token 来开始使用</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>名称</th>
                    <th>最后使用</th>
                    <th>创建时间</th>
                    <th className="text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTokens.map((token) => (
                    <tr key={token.id}>
                      <td>
                        <code className="text-sm font-mono bg-base-200 px-2 py-1 rounded">
                          {token.token}
                        </code>
                      </td>
                      <td>
                        <div className="font-medium">
                          {token.name || (
                            <span className="text-base-content/50 italic">未命名</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {token.lastUsedAt ? (
                          <div className="text-sm">
                            <div>{formatDate(token.lastUsedAt)}</div>
                            {token.lastUsedIp && (
                              <div className="text-xs text-base-content/50 font-mono">
                                {token.lastUsedIp}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-base-content/50 text-sm">从未使用</span>
                        )}
                      </td>
                      <td className="text-sm">
                        {formatDate(token.createdAt)}
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-error btn-sm"
                          onClick={() => handleRevokeToken(token)}
                          disabled={revokeTokenMutation.isPending}
                        >
                          撤销
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Revoked Tokens */}
      {revokedTokens.length > 0 && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-header p-4 pb-0">
            <h2 className="text-lg font-semibold text-base-content flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              已撤销的 Token
              <span className="badge badge-ghost badge-sm">{revokedTokens.length}</span>
            </h2>
          </div>
          <div className="card-body p-4 pt-2">
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>名称</th>
                    <th>创建时间</th>
                    <th>撤销时间</th>
                  </tr>
                </thead>
                <tbody>
                  {revokedTokens.map((token) => (
                    <tr key={token.id} className="opacity-60">
                      <td>
                        <code className="text-sm font-mono bg-base-200 px-2 py-1 rounded">
                          {token.token}
                        </code>
                      </td>
                      <td>
                        <div className="font-medium">
                          {token.name || (
                            <span className="text-base-content/50 italic">未命名</span>
                          )}
                        </div>
                      </td>
                      <td className="text-sm">
                        {formatDate(token.createdAt)}
                      </td>
                      <td className="text-sm">
                        {token.revokedAt ? formatDate(token.revokedAt) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Usage Information */}
      <div className="alert alert-info">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h3 className="font-bold">API Token 使用说明</h3>
          <div className="text-sm mt-1">
            <div>• 在HTTP请求中使用 <code className="bg-base-300 px-1 rounded">Authorization: Bearer mgp_your_token</code> 头部认证</div>
            <div>• Token 只在创建时显示一次，请妥善保管</div>
            <div>• 撤销后的 Token 将立即失效且无法恢复</div>
          </div>
        </div>
      </div>

      {/* Confirm Revoke Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="撤销 Token"
        message={confirmDialog.token ? `确定要撤销 Token "${confirmDialog.token.name || 'ID: ' + confirmDialog.token.id}" 吗？撤销后将无法恢复，所有使用此 Token 的服务将无法访问 API。` : ''}
        type="danger"
        confirmText="撤销"
        cancelText="取消"
        onConfirm={handleConfirmRevoke}
        onCancel={handleCancelRevoke}
      />
    </div>
  )
}