import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function AdminLogin() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isInitMode, setIsInitMode] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  
  const { login, initAdmin, checkAdminExists, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  // Check if admin exists on mount
  useEffect(() => {
    async function checkAdmin() {
      setCheckingAdmin(true)
      try {
        const exists = await checkAdminExists()
        setIsInitMode(!exists)
      } catch (error) {
        console.error('Failed to check admin status:', error)
      } finally {
        setCheckingAdmin(false)
      }
    }
    checkAdmin()
  }, [checkAdminExists])

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin')
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (isInitMode) {
        // Initialize admin mode
        if (password !== confirmPassword) {
          setError('密码不匹配')
          setIsLoading(false)
          return
        }

        if (password.length < 8) {
          setError('密码长度至少需要8个字符')
          setIsLoading(false)
          return
        }

        const initResult = await initAdmin(password)
        if (initResult.success) {
          // After successful init, login automatically
          const loginResult = await login(password)
          if (loginResult.success) {
            navigate('/admin')
          } else {
            setError(loginResult.error || 'Login failed after initialization')
          }
        } else {
          setError(initResult.error || 'Failed to initialize admin account')
        }
      } else {
        // Normal login mode
        const result = await login(password)
        if (result.success) {
          navigate('/admin')
        } else {
          setError(result.error || 'Login failed')
        }
      }
    } catch (error) {
      console.error('Submit error:', error)
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (checkingAdmin) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="text-base-content/60">正在检查系统状态...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-primary mb-2">Magpie</h1>
            <h2 className="text-xl font-semibold text-base-content">
              {isInitMode ? '初始化管理员账户' : '管理员登录'}
            </h2>
            {isInitMode && (
              <p className="text-sm text-base-content/60 mt-2">
                设置您的管理员账户以开始使用
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  {isInitMode ? '创建密码' : '密码'}
                </span>
              </label>
              <input
                type="password"
                className="input input-bordered"
                placeholder={isInitMode ? '输入一个强密码' : '输入您的密码'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                disabled={isLoading}
              />
              {isInitMode && (
                <label className="label">
                  <span className="label-text-alt text-base-content/50">
                    建议至少8个字符
                  </span>
                </label>
              )}
            </div>

            {isInitMode && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    确认密码
                  </span>
                </label>
                <input
                  type="password"
                  className="input input-bordered"
                  placeholder="重新输入您的密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            )}

            {error && (
              <div className="alert alert-error">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="loading loading-spinner loading-sm"></span>
                  {isInitMode ? '正在创建账户...' : '正在登录...'}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {isInitMode ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      创建管理员账户
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      登录
                    </>
                  )}
                </span>
              )}
            </button>
          </form>

          {isInitMode && (
            <div className="mt-6 p-4 bg-base-200 rounded-lg">
              <p className="text-sm text-base-content/70">
                <svg className="w-4 h-4 inline mr-2 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <strong>首次设置：</strong>此密码将用于访问管理面板。
                请妥善保管并牢记。
              </p>
            </div>
          )}

          <div className="mt-6 text-center">
            <a 
              href="/" 
              className="link link-hover text-sm text-base-content/60"
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              返回首页
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
