import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth()
  const location = useLocation()

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="text-base-content/60">Loading...</p>
        </div>
      </div>
    )
  }

  // Check if user is not authenticated
  if (!isAuthenticated) {
    // Redirect to login page, but save the location they were trying to go to
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  // Check if admin role is required
  if (requireAdmin && user?.role !== 'admin') {
    // User is authenticated but doesn't have admin role
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="card max-w-md bg-base-100 shadow-xl">
          <div className="card-body text-center">
            <svg className="w-16 h-16 mx-auto text-error mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-2xl font-bold text-base-content mb-2">Access Denied</h2>
            <p className="text-base-content/60 mb-4">
              You do not have permission to access this page.
            </p>
            <div className="flex gap-2 justify-center">
              <a href="/" className="btn btn-ghost">
                Go Home
              </a>
              <button 
                onClick={() => window.history.back()} 
                className="btn btn-primary"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // User is authenticated and has required permissions
  return <>{children}</>
}