import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Suspense, lazy } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'

// Lazy load pages for better code splitting
const HomePage = lazy(() => import('./pages/HomePage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="loading loading-spinner loading-lg"></div>
  </div>
)

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-base-100">
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/link/:id" element={<HomePage />} />
              <Route path="/category/:name" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route 
                path="/admin/login" 
                element={
                  <AuthProvider>
                    <AdminLogin />
                  </AuthProvider>
                } 
              />
              <Route 
                path="/admin/*" 
                element={
                  <AuthProvider>
                    <ProtectedRoute requireAdmin>
                      <AdminPage />
                    </ProtectedRoute>
                  </AuthProvider>
                } 
              />
            </Routes>
          </Suspense>
        </div>
      </Router>
    </QueryClientProvider>
  )
}

export default App