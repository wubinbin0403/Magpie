import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import SearchPage from './pages/SearchPage'
import AdminPage from './pages/AdminPage'
import AdminLogin from './pages/admin/AdminLogin'
import './App.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-base-100">
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
        </div>
      </Router>
    </QueryClientProvider>
  )
}

export default App