import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../../utils/api'
import type { ApiResponse, StatsResponse } from '@magpie/shared'

interface Stats {
  totalLinks: number
  pendingLinks: number
  monthlyNew: number
  totalCategories: number
  totalTags: number
  recentActivity: {
    type: 'link_added' | 'link_published' | 'link_deleted'
    title: string
    url?: string
    timestamp: string
  }[]
}

export default function AdminOverview() {
  const queryClient = useQueryClient()
  
  const { data: statsData, isLoading } = useQuery<ApiResponse<StatsResponse>>({
    queryKey: ['admin-stats-summary'],
    queryFn: async () => {
      // Get user's timezone offset in minutes (negative for UTC+)
      const timezoneOffset = new Date().getTimezoneOffset()
      return await api.getStats({ tz: -timezoneOffset })
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  })

  // Transform API data to match component interface
  const stats: Stats | undefined = statsData?.success ? {
    totalLinks: statsData.data.totalLinks,
    pendingLinks: statsData.data.pendingLinks,
    monthlyNew: statsData.data.monthlyStats?.[statsData.data.monthlyStats.length - 1]?.count || 0,
    totalCategories: statsData.data.totalCategories,
    totalTags: statsData.data.totalTags,
    recentActivity: statsData.data.recentActivity
  } : undefined

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'link_added': 
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
      case 'link_published': 
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      case 'link_deleted': 
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      default: 
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 8h6m-6 4h6" /></svg>
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'link_added': return 'text-blue-600'
      case 'link_published': return 'text-green-600'
      case 'link_deleted': return 'text-red-600'
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

  const handleRefresh = () => {
    // Force refresh the stats
    queryClient.invalidateQueries({ queryKey: ['admin-stats-summary'] })
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        {/* Page header skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <div className="h-9 bg-base-300 rounded w-64"></div>
            <div className="h-5 bg-base-300 rounded w-48 mt-2"></div>
          </div>
        </div>
        
        {/* Stats skeleton */}
        <div className="bg-base-100 p-6">
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-12">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="text-center">
                <div className="h-9 bg-base-300 rounded w-16 mx-auto"></div>
                <div className="h-4 bg-base-300 rounded w-20 mx-auto mt-2"></div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Quick actions skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card bg-base-100 shadow-sm">
              <div className="card-body p-4">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-base-300 rounded"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-base-300 rounded w-24"></div>
                    <div className="h-3 bg-base-300 rounded w-32 mt-1"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Recent activity skeleton */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-6">
            <div className="h-6 bg-base-300 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-2">
                  <div className="w-4 h-4 bg-base-300 rounded"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-base-300 rounded w-3/4"></div>
                    <div className="h-3 bg-base-300 rounded w-1/2 mt-1"></div>
                  </div>
                  <div className="w-16 h-6 bg-base-300 rounded-full"></div>
                </div>
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
          <h1 className="text-3xl font-bold text-base-content">仪表盘概览</h1>
          <p className="text-base-content/60 mt-1">系统状态和最近活动</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={handleRefresh}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </button>
        </div>
      </div>

      {/* Stats overview */}
      <div className="bg-base-100 p-6">
        <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-12">
          <div className="text-center">
            <div className="text-3xl font-bold text-magpie-200">{stats?.totalLinks || 0}</div>
            <div className="text-sm text-base-content/60">链接总数</div>
          </div>
          
          <div className="w-px h-12 bg-base-content/10"></div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-500">{stats?.pendingLinks || 0}</div>
            <div className="text-sm text-base-content/60">待审核</div>
          </div>
          
          <div className="w-px h-12 bg-base-content/10"></div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-green-500">{stats?.monthlyNew || 0}</div>
            <div className="text-sm text-base-content/60">本月新增</div>
          </div>
          
          <div className="w-px h-12 bg-base-content/10"></div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-500">{stats?.totalCategories || 0}</div>
            <div className="text-sm text-base-content/60">分类数</div>
          </div>
          
          <div className="w-px h-12 bg-base-content/10"></div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-indigo-500">{stats?.totalTags || 0}</div>
            <div className="text-sm text-base-content/60">标签数</div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/admin/links" className="group relative p-6 rounded-xl bg-base-100 hover:bg-magpie-200/5 transition-all duration-300 hover:shadow-sm">
          {/* Large background icon */}
          <div className="absolute top-2 left-2 w-14 h-14 flex items-center justify-center">
            <div className="text-gray-400/20 group-hover:text-magpie-200/25 transition-all duration-300">
              <svg className="w-full h-full transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} stroke="currentColor" fill="none"/>
              </svg>
            </div>
          </div>
          
          {/* Content */}
          <div className="relative z-10 flex flex-col items-center justify-center min-h-[80px]">
            <div className="text-lg font-bold text-gray-800 group-hover:text-magpie-300 transition-colors duration-300">
              添加链接
            </div>
            <div className="text-sm text-base-content/60 mt-1">
              快速添加链接
            </div>
          </div>
        </Link>

        <Link to="/admin/pending" className="group relative p-6 rounded-xl bg-base-100 hover:bg-magpie-200/5 transition-all duration-300 hover:shadow-sm">
          {/* Large background icon */}
          <div className="absolute top-2 left-2 w-14 h-14 flex items-center justify-center">
            <div className="text-gray-400/20 group-hover:text-orange-500/25 transition-all duration-300">
              <svg className="w-full h-full transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-12" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} stroke="currentColor" fill="none"/>
              </svg>
            </div>
          </div>
          
          {/* Badge in top-right corner */}
          <div className="absolute top-3 right-3 z-10">
            <span className="text-xs font-medium text-orange-500 bg-orange-500/10 px-2 py-1 rounded-full">
              {stats?.pendingLinks || 0}
            </span>
          </div>
          
          {/* Content */}
          <div className="relative z-10 flex flex-col items-center justify-center min-h-[80px]">
            <div className="text-lg font-bold text-gray-800 group-hover:text-orange-500 transition-colors duration-300">
              审核待处理
            </div>
            <div className="text-sm text-base-content/60 mt-1">
              {stats?.pendingLinks || 0} 项待处理
            </div>
          </div>
        </Link>

        <Link to="/admin/system" className="group relative p-6 rounded-xl bg-base-100 hover:bg-magpie-200/5 transition-all duration-300 hover:shadow-sm">
          {/* Large background icon */}
          <div className="absolute top-2 left-2 w-14 h-14 flex items-center justify-center">
            <div className="text-gray-400/20 group-hover:text-magpie-200/25 transition-all duration-300">
              <svg className="w-full h-full transition-transform duration-500 group-hover:scale-110 group-hover:rotate-45" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} stroke="currentColor" fill="none"/>
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} stroke="currentColor" fill="none"/>
              </svg>
            </div>
          </div>
          
          {/* Content */}
          <div className="relative z-10 flex flex-col items-center justify-center min-h-[80px]">
            <div className="text-lg font-bold text-gray-800 group-hover:text-magpie-300 transition-colors duration-300">
              系统设置
            </div>
            <div className="text-sm text-base-content/60 mt-1">
              配置和偏好设置
            </div>
          </div>
        </Link>
      </div>

      {/* Recent activity */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-header p-6 pb-0">
          <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            最近活动
          </h2>
        </div>
        <div className="card-body p-6 pt-4">
          <div className="space-y-3">
            {(stats?.recentActivity || []).map((activity, index) => (
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
                <div className={`text-xs px-2 py-1 rounded-full ${
                  activity.type === 'link_added' ? 'bg-blue-100 text-blue-700' :
                  activity.type === 'link_published' ? 'bg-green-100 text-green-700' :
                  activity.type === 'link_deleted' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {activity.type === 'link_added' ? '已添加' :
                   activity.type === 'link_published' ? '已发布' :
                   activity.type === 'link_deleted' ? '已删除' :
                   activity.type}
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-4">
            <button className="btn btn-ghost btn-sm">
              查看所有活动
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