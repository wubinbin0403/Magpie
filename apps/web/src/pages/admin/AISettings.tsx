import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../../utils/api'

interface AISettings {
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
  summaryPrompt: string
  categoryPrompt: string
}

export default function AISettings() {
  const [settings, setSettings] = useState<AISettings>({
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    summaryPrompt: '',
    categoryPrompt: ''
  })
  const [lastTestResult, setLastTestResult] = useState<any>(null)
  const [apiKeyTouched, setApiKeyTouched] = useState(false)
  const [originalApiKey, setOriginalApiKey] = useState('')

  // Format API Key for display (show first few and last few characters)
  const formatApiKeyForDisplay = (apiKey: string): string => {
    if (!apiKey) return ''
    if (apiKey.length <= 8) return '*'.repeat(apiKey.length)
    
    const start = apiKey.slice(0, 3) // Show first 3 characters (like "sk-")
    const end = apiKey.slice(-3)     // Show last 3 characters
    const middle = '*'.repeat(Math.max(0, Math.min(apiKey.length - 6, 40))) // Middle stars, max 40
    
    return `${start}${middle}${end}`
  }

  // Fetch system settings
  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const response = await api.getSettings()
      return response.data
    }
  })

  // Update local settings when data is loaded
  useEffect(() => {
    if (settingsData?.ai) {
      setSettings(settingsData.ai)
      setOriginalApiKey(settingsData.ai.apiKey || '')
      setApiKeyTouched(false)
    }
  }, [settingsData])

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: { ai: AISettings }) => {
      const response = await api.updateSettings(newSettings)
      return response.data
    },
    onSuccess: () => {
      setOriginalApiKey(settings.apiKey)
      setApiKeyTouched(false)
      showToast('AI设置保存成功！', 'success')
    }
  })

  // Test AI connection mutation  
  const testAIMutation = useMutation({
    mutationFn: async () => {
      // Always use originalApiKey if user hasn't modified the API key
      // Use settings.apiKey only if user has actually edited it
      const apiKeyToUse = apiKeyTouched ? settings.apiKey : originalApiKey
      
      if (!apiKeyToUse) {
        throw new Error('API Key未配置')
      }
      
      const testConfig = {
        apiKey: apiKeyToUse,
        baseUrl: settings.baseUrl,
        model: settings.model,
        temperature: settings.temperature,
        summaryPrompt: settings.summaryPrompt,
        categoryPrompt: settings.categoryPrompt
      }
      const response = await api.testAiConnection(testConfig)
      return response
    },
    onSuccess: (data) => {
      setLastTestResult(data)
      if (data.success) {
        showToast('AI连接测试成功！', 'success')
      } else {
        showToast('AI连接测试失败', 'error')
      }
    },
    onError: (error) => {
      setLastTestResult({ success: false, message: error.message })
      showToast('AI连接测试失败', 'error')
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

  const handleSave = useCallback(() => {
    const settingsToSave = {
      ...settings,
      apiKey: apiKeyTouched ? settings.apiKey : originalApiKey
    }
    updateSettingsMutation.mutate({ ai: settingsToSave })
  }, [updateSettingsMutation, settings, apiKeyTouched, originalApiKey])

  const handleTestAI = useCallback(() => {
    testAIMutation.mutate()
  }, [testAIMutation])

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">AI 服务设置</h1>
          <p className="text-base-content/60 mt-1">配置 AI 分析服务和自定义提示词</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            className={`btn btn-primary ${updateSettingsMutation.isPending ? 'loading' : ''}`}
            onClick={handleSave}
            disabled={updateSettingsMutation.isPending}
          >
            {updateSettingsMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="loading loading-spinner loading-sm"></span>
                正在保存...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                保存配置
              </span>
            )}
          </button>
        </div>
      </div>

      {/* OpenAI API Configuration */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-header p-6 pb-0">
          <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            OpenAI API 配置
          </h2>
        </div>
        <div className="card-body p-6 pt-4 space-y-4">
          {/* API Base URL */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">API Base URL</span>
              <span className="label-text-alt text-base-content/60">AI服务的基础URL地址</span>
            </label>
            <input
              type="url"
              className="input input-bordered"
              value={settings.baseUrl}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                baseUrl: e.target.value
              }))}
              placeholder="https://api.openai.com/v1"
            />
          </div>

          {/* API Key */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">API Key</span>
              <span className="label-text-alt text-base-content/60">用于访问AI服务的密钥</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={apiKeyTouched ? settings.apiKey : (originalApiKey ? formatApiKeyForDisplay(originalApiKey) : '')}
                  onChange={(e) => {
                    setApiKeyTouched(true)
                    setSettings(prev => ({
                      ...prev,
                      apiKey: e.target.value
                    }))
                  }}
                  onFocus={() => {
                    if (!apiKeyTouched && originalApiKey) {
                      setApiKeyTouched(true)
                      setSettings(prev => ({
                        ...prev,
                        apiKey: originalApiKey
                      }))
                    }
                  }}
                  placeholder={originalApiKey ? "点击编辑已保存的API Key" : "sk-..."}
                />
              </div>
              <button 
                className="btn btn-outline"
                onClick={handleTestAI}
                disabled={testAIMutation.isPending || !(apiKeyTouched ? settings.apiKey.trim() : originalApiKey.trim())}
              >
                {testAIMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="loading loading-spinner loading-sm"></span>
                    测试中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    测试连接
                  </span>
                )}
              </button>
            </div>
            
            {/* Test Result */}
            {lastTestResult && (
              <div className={`flex items-center gap-2 text-sm mt-2 ${lastTestResult.success ? 'text-success' : 'text-error'}`}>
                <svg className={`w-4 h-4 ${lastTestResult.success ? 'text-success' : 'text-error'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {lastTestResult.success ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  )}
                </svg>
                <span>
                  {lastTestResult.success 
                    ? `连接成功 (${lastTestResult.data.responseTime}ms)` 
                    : `连接失败: ${lastTestResult.message}`
                  }
                </span>
              </div>
            )}
          </div>

          {/* Model Selection */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">AI 模型</span>
              <span className="label-text-alt text-base-content/60">输入要使用的模型ID</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              value={settings.model}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                model: e.target.value
              }))}
              placeholder="gpt-3.5-turbo"
            />
            <div className="label">
              <span className="label-text-alt text-base-content/50">
                常用模型: gpt-3.5-turbo, gpt-4, claude-3-sonnet, gemini-pro 等
              </span>
            </div>
          </div>

          {/* Temperature Parameter */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">温度参数 (0.0 - 2.0)</span>
              <span className="label-text-alt text-base-content/60">当前: {settings.temperature}</span>
            </label>
            <div className="flex items-center gap-4">
              <span className="text-sm text-base-content/60">0.0</span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                className="range range-primary flex-1"
                value={settings.temperature}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  temperature: parseFloat(e.target.value)
                }))}
              />
              <span className="text-sm text-base-content/60">2.0</span>
            </div>
            <div className="text-xs text-base-content/50 mt-1">
              较低值使输出更确定性，较高值使输出更有创造性
            </div>
          </div>
        </div>
      </div>

      {/* AI Prompt Template Configuration */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-header p-6 pb-0">
          <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            AI Prompt 模板配置
          </h2>
        </div>
        <div className="card-body p-6 pt-4 space-y-4">
          {/* Summary Prompt */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">摘要生成 Prompt</span>
              <span className="label-text-alt text-base-content/60">用于生成内容摘要的提示词模板</span>
            </label>
            <textarea
              className="textarea textarea-bordered h-32"
              value={settings.summaryPrompt}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                summaryPrompt: e.target.value
              }))}
              placeholder={`请分析以下网页内容，生成50字以内的中文摘要：

标题：{title}
URL：{url}
内容：{content}

要求：
1. 简洁明了，突出核心观点
2. 50字以内
3. 使用中文

（留空使用默认模板）`}
            />
          </div>

          {/* Category Prompt */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">分类提示词</span>
              <span className="label-text-alt text-base-content/60">用于内容分类的提示词模板</span>
            </label>
            <textarea
              className="textarea textarea-bordered h-32"
              value={settings.categoryPrompt}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                categoryPrompt: e.target.value
              }))}
              placeholder={`根据以下网页内容，从指定分类中选择最合适的一个：

标题：{title}
内容：{content}
可用分类：{categories}

要求：只返回分类名称，不要解释

（留空使用默认模板）`}
            />
          </div>
        </div>
      </div>

      {/* Test Result Details */}
      {lastTestResult?.success && lastTestResult.data.testAnalysis && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-header p-6 pb-0">
            <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              测试结果示例
            </h2>
          </div>
          <div className="card-body p-6 pt-4">
            <div className="bg-base-200 p-4 rounded-lg space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-base-content/80">模型:</span>
                  <span className="ml-2">{lastTestResult.data.model}</span>
                </div>
                <div>
                  <span className="font-medium text-base-content/80">响应时间:</span>
                  <span className="ml-2">{lastTestResult.data.responseTime}ms</span>
                </div>
              </div>
              <div>
                <span className="font-medium text-base-content/80">摘要:</span>
                <p className="mt-1 text-base-content/90">{lastTestResult.data.testAnalysis.summary}</p>
              </div>
              <div>
                <span className="font-medium text-base-content/80">分类:</span>
                <span className="ml-2 badge badge-outline">{lastTestResult.data.testAnalysis.category}</span>
              </div>
              <div>
                <span className="font-medium text-base-content/80">标签:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {lastTestResult.data.testAnalysis.tags.map((tag: string, index: number) => (
                    <span key={index} className="badge badge-outline badge-sm">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save reminder */}
      <div className="alert alert-info">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h3 className="font-bold">别忘记保存！</h3>
          <div className="text-xs">点击上方的"保存配置"按钮后更改将生效。</div>
        </div>
      </div>
    </div>
  )
}