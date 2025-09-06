import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'

interface User {
  role: 'admin'
  permissions: string[]
}

interface AuthContextType {
  isAuthenticated: boolean
  user: User | null
  token: string | null
  login: (password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  initAdmin: (password: string) => Promise<{ success: boolean; error?: string }>
  checkAdminExists: () => Promise<boolean>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'admin_token'
const USER_KEY = 'admin_user'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  // Validate token with server
  const validateToken = useCallback(async (token: string) => {
    try {
      // Use the protected verify endpoint to validate token
      const response = await fetch('/api/admin/verify', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.status === 401 || response.status === 403) {
        // Token is invalid, clear auth state
        return false
      }

      return response.ok
    } catch (error) {
      console.error('Token validation error:', error)
      return false
    }
  }, [])

  // Load auth state from localStorage on mount and validate
  useEffect(() => {
    async function loadAndValidateAuth() {
      const storedToken = localStorage.getItem(TOKEN_KEY)
      const storedUser = localStorage.getItem(USER_KEY)

      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser)
          
          // Validate token with server
          const isValid = await validateToken(storedToken)
          
          if (isValid) {
            setToken(storedToken)
            setUser(parsedUser)
            setIsAuthenticated(true)
          } else {
            // Token is invalid, clear stored data
            localStorage.removeItem(TOKEN_KEY)
            localStorage.removeItem(USER_KEY)
          }
        } catch (error) {
          console.error('Failed to parse stored user data:', error)
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(USER_KEY)
        }
      }
      setIsLoading(false)
    }

    loadAndValidateAuth()
  }, [validateToken])

  const login = useCallback(async (password: string) => {
    try {
      const data = await api.adminLogin(password)

      if (data.success) {
        const { token: authToken, user: userData } = data.data
        
        // Store auth data
        localStorage.setItem(TOKEN_KEY, authToken)
        localStorage.setItem(USER_KEY, JSON.stringify(userData))
        
        // Update state
        setToken(authToken)
        setUser(userData)
        setIsAuthenticated(true)

        return { success: true }
      } else {
        return { 
          success: false, 
          error: !data.success ? data.error.message : 'Login failed' 
        }
      }
    } catch (error) {
      console.error('Login error:', error)
      return { 
        success: false, 
        error: 'Network error. Please try again.' 
      }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      // Call logout API
      if (token) {
        await api.adminLogout()
      }
    } catch (error) {
      console.error('Logout API error:', error)
    } finally {
      // Clear local storage and state
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      setToken(null)
      setUser(null)
      setIsAuthenticated(false)
      
      // Navigate to login page
      navigate('/admin/login')
    }
  }, [token, navigate])

  const initAdmin = useCallback(async (password: string) => {
    try {
      const data = await api.adminInit(password)

      if (data.success) {
        return { success: true }
      } else {
        return { 
          success: false, 
          error: !data.success ? data.error.message : 'Failed to initialize admin account' 
        }
      }
    } catch (error) {
      console.error('Init admin error:', error)
      return { 
        success: false, 
        error: 'Network error. Please try again.' 
      }
    }
  }, [])

  const checkAdminExists = useCallback(async () => {
    try {
      // Use direct fetch for this endpoint since it's public
      const response = await fetch('/api/admin/check', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        return data.data?.exists || false
      }
      
      // On error, assume admin exists to be safe
      return true
    } catch (error) {
      console.error('Check admin exists error:', error)
      // Assume admin exists on network error to be safe
      return true
    }
  }, [])

  const value = {
    isAuthenticated,
    user,
    token,
    login,
    logout,
    initAdmin,
    checkAdminExists,
    isLoading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}