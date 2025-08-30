import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import AdminNavBar from '../components/AdminNavBar'
import AdminSidebar from '../components/AdminSidebar'
import AdminOverview from './admin/AdminOverview'
import PendingLinks from './admin/PendingLinks'
import AddLink from './admin/AddLink'
import SystemSettings from './admin/SystemSettings'

// Mock user data - in real app this would come from auth context
const mockUser = {
  role: 'admin',
  name: 'Administrator'
}

export default function AdminPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Mock stats query for sidebar badges
  const { data: stats } = useQuery({
    queryKey: ['admin-stats-summary'],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 200))
      return {
        pendingCount: 5,
        totalLinks: 123
      }
    }
  })

  return (
    <div className="min-h-screen bg-base-100">
      {/* Admin Navigation Bar */}
      <AdminNavBar 
        onToggleSidebar={() => setSidebarOpen(true)}
        user={mockUser}
      />
      
      {/* Fixed Admin Sidebar - completely fixed to screen */}
      <aside className="hidden lg:block fixed left-0 top-16 bottom-0 w-80 bg-base-200/30 z-40">
        <AdminSidebar
          pendingCount={stats?.pendingCount}
          totalLinks={stats?.totalLinks}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </aside>
      
      <div className="lg:ml-80 bg-base-100 min-h-screen">
        {/* Content area with left margin to account for fixed sidebar */}

        {/* Mobile Admin Sidebar Drawer */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-black/20" onClick={() => setSidebarOpen(false)} />
            <aside className="relative w-80 bg-base-200/30 shadow-xl h-full flex flex-col">
              <AdminSidebar
                pendingCount={stats?.pendingCount}
                totalLinks={stats?.totalLinks}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
              />
            </aside>
          </div>
        )}

        {/* Main Content Area */}
        <main className="min-h-screen pt-16">
          <div className="container mx-auto px-4 lg:px-6 py-6">
            <Routes>
              <Route path="/" element={<AdminOverview />} />
              <Route path="/overview" element={<Navigate to="/admin" replace />} />
              
              {/* Dashboard routes */}
              <Route path="/pending" element={<PendingLinks />} />
              <Route path="/links" element={<div>All Links Page (Coming Soon)</div>} />
              <Route path="/activity" element={<div>Activity Page (Coming Soon)</div>} />
              
              {/* Link Management routes */}
              <Route path="/add" element={<AddLink />} />
              <Route path="/confirm" element={<div>Confirm Pending Page (Coming Soon)</div>} />
              <Route path="/manage" element={<div>Manage Links Page (Coming Soon)</div>} />
              
              {/* Settings routes */}
              <Route path="/system" element={<SystemSettings />} />
              <Route path="/tokens" element={<div>API Tokens Page (Coming Soon)</div>} />
              <Route path="/ai-settings" element={<div>AI Settings Page (Coming Soon)</div>} />
              <Route path="/categories" element={<div>Categories Page (Coming Soon)</div>} />
              
              {/* Tools routes */}
              <Route path="/import" element={<div>Import Data Page (Coming Soon)</div>} />
              <Route path="/export" element={<div>Export Data Page (Coming Soon)</div>} />
              <Route path="/cleanup" element={<div>Cleanup Page (Coming Soon)</div>} />
              
              {/* Catch all - redirect to overview */}
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}