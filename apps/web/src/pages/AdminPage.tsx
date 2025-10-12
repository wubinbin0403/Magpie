import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../utils/api'
import { isSuccessResponse } from '../utils/api-helpers'
import type { ApiResponse, StatsResponse } from '@magpie/shared'
import AdminNavBar from '../components/AdminNavBar'
import AdminSidebar from '../components/AdminSidebar'
import AdminOverview from './admin/AdminOverview'
import PendingLinks from './admin/PendingLinks'
import AllLinks from './admin/AllLinks'
import AddLink from './admin/AddLink'
import SystemSettings from './admin/SystemSettings'
import AISettings from './admin/AISettings'
import ApiTokens from './admin/ApiTokens'
import AdminActivity from './admin/AdminActivity'
import DownloadTools from './admin/DownloadTools'

// Mock user data - in real app this would come from auth context
const mockUser = {
  role: 'admin',
  name: 'Administrator'
}

export default function AdminPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Real stats query for sidebar badges
  const { data: statsResponse } = useQuery<ApiResponse<StatsResponse>>({
    queryKey: ['admin-stats-summary'],
    queryFn: async () => api.getStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  })

  const stats = statsResponse && isSuccessResponse(statsResponse)
    ? {
        pendingCount: statsResponse.data.pendingLinks,
        totalLinks: statsResponse.data.totalLinks
      }
    : undefined

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
              <Route path="/links" element={<AllLinks />} />
              <Route path="/activity" element={<AdminActivity />} />
              
              {/* Link Management routes */}
              <Route path="/add" element={<AddLink />} />
              <Route path="/confirm" element={<div>确认待处理页面（即将推出）</div>} />
              <Route path="/manage" element={<div>管理链接页面（即将推出）</div>} />
              
              {/* Settings routes */}
              <Route path="/system" element={<SystemSettings />} />
              <Route path="/tokens" element={<ApiTokens />} />
              <Route path="/ai-settings" element={<AISettings />} />
              <Route path="/categories" element={<div>分类页面（即将推出）</div>} />
              
              {/* Tools routes */}
              <Route path="/import" element={<div>导入数据页面（即将推出）</div>} />
              <Route path="/export" element={<div>导出数据页面（即将推出）</div>} />
              <Route path="/cleanup" element={<div>清理页面（即将推出）</div>} />
              <Route path="/tools/download" element={<DownloadTools />} />
              
              {/* Catch all - redirect to overview */}
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}
