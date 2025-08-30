import { useQuery } from '@tanstack/react-query'

interface Stats {
  totalLinks: number
  pendingLinks: number
  monthlyNew: number
  databaseSize: string
  recentActivity: {
    type: 'added' | 'published' | 'deleted'
    title: string
    timestamp: string
  }[]
}

// Mock data for now
const mockStats: Stats = {
  totalLinks: 123,
  pendingLinks: 5,
  monthlyNew: 12,
  databaseSize: '1.2GB',
  recentActivity: [
    { type: 'published', title: 'React 19 新特性详解', timestamp: '2024-08-30T15:30:00Z' },
    { type: 'added', title: 'Vue 3.4 性能优化指南', timestamp: '2024-08-30T14:20:00Z' },
    { type: 'published', title: 'TypeScript 5.0 发布', timestamp: '2024-08-30T12:15:00Z' },
    { type: 'added', title: 'Tailwind CSS 最佳实践', timestamp: '2024-08-29T16:45:00Z' },
    { type: 'deleted', title: '过时的技术文档', timestamp: '2024-08-29T10:30:00Z' }
  ]
}

export default function AdminOverview() {
  // In real implementation, this would fetch from API
  const { data: stats = mockStats, isLoading } = useQuery<Stats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 500))
      return mockStats
    }
  })

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'added': 
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
      case 'published': 
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      case 'deleted': 
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      default: 
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 8h6m-6 4h6" /></svg>
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'added': return 'text-blue-600'
      case 'published': return 'text-green-600'
      case 'deleted': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return '刚刚'
    if (diffInHours < 24) return `${diffInHours}小时前`
    return `${Math.floor(diffInHours / 24)}天前`
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card bg-base-100 shadow-sm">
              <div className="card-body p-6">
                <div className="h-8 bg-base-300 rounded"></div>
                <div className="h-4 bg-base-300 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-6">
            <div className="h-6 bg-base-300 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-base-300 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Dashboard Overview</h1>
          <p className="text-base-content/60 mt-1">System status and recent activity</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="card-body p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-magpie-200">{stats.totalLinks}</div>
                <div className="text-sm text-base-content/60">Total Links</div>
              </div>
              <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="card-body p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-orange-500">{stats.pendingLinks}</div>
                <div className="text-sm text-base-content/60">Pending Review</div>
              </div>
              <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="card-body p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-green-500">{stats.monthlyNew}</div>
                <div className="text-sm text-base-content/60">This Month</div>
              </div>
              <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="card-body p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-purple-500">{stats.databaseSize}</div>
                <div className="text-sm text-base-content/60">Database Size</div>
              </div>
              <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
          <div className="card-body p-4">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <div>
                <div className="font-medium">Add New Link</div>
                <div className="text-sm text-base-content/60">Quick link addition for testing</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
          <div className="card-body p-4">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="font-medium">Review Pending</div>
                <div className="text-sm text-base-content/60">{stats.pendingLinks} items waiting</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
          <div className="card-body p-4">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <div className="font-medium">System Settings</div>
                <div className="text-sm text-base-content/60">Configure AI and preferences</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-header p-6 pb-0">
          <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Recent Activity
          </h2>
        </div>
        <div className="card-body p-6 pt-4">
          <div className="space-y-3">
            {stats.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center gap-4 py-2">
                <div className={`${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-base-content truncate">
                    {activity.title}
                  </div>
                  <div className="text-xs text-base-content/60">
                    {formatTime(activity.timestamp)}
                  </div>
                </div>
                <div className={`text-xs px-2 py-1 rounded-full capitalize ${
                  activity.type === 'added' ? 'bg-blue-100 text-blue-700' :
                  activity.type === 'published' ? 'bg-green-100 text-green-700' :
                  activity.type === 'deleted' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {activity.type}
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-4">
            <button className="btn btn-ghost btn-sm">
              View All Activity
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}