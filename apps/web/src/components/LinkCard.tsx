import { useState } from 'react'
import api from '../utils/api'
import CategoryBadge from './CategoryBadge'
import TagList from './TagList'
import type { Link } from '@magpie/shared'

interface LinkCardProps {
  link: Link
  onTitleClick?: () => void
  onTagClick?: (tag: string) => void
  selectedTags?: string[]
}

export default function LinkCard({ link, onTitleClick, onTagClick, selectedTags = [] }: LinkCardProps) {
  const [domainCount, setDomainCount] = useState<number | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)
  const [showDateTooltip, setShowDateTooltip] = useState(false)
  const [showReadingTimeTooltip, setShowReadingTimeTooltip] = useState(false)

  // Fetch domain count on hover using new dedicated API
  const fetchDomainCount = async () => {
    if (domainCount !== null) return // Already fetched
    
    try {
      const response = await api.getDomainStats(link.domain)
      if (response.success && response.data) {
        setDomainCount(response.data.count)
      }
    } catch (error) {
      console.error('Failed to fetch domain count:', error)
      // Set to 0 to show something rather than keep loading
      setDomainCount(0)
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    const now = new Date()
    
    // 计算日期差异（只考虑日期，不考虑时间）
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const diffTime = nowOnly.getTime() - dateOnly.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      // 今天：显示小时前
      const hoursDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
      if (hoursDiff === 0) {
        const minutesDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
        return minutesDiff <= 0 ? '刚刚' : `${minutesDiff}分钟前`
      }
      return `${hoursDiff}小时前`
    }
    if (diffDays === 1) return '昨天'
    if (diffDays < 7) return `${diffDays}天前`
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)}周前`
    if (diffDays < 365) return `${Math.ceil(diffDays / 30)}个月前`
    
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatFullDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  // Format reading time: <1h shows "X分钟", >=1h shows "X小时Y分钟"
  const formatReadingTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}分钟`
    } else {
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      if (remainingMinutes === 0) {
        return `${hours}小时`
      } else {
        return `${hours}小时${remainingMinutes}分钟`
      }
    }
  }

  const handleDomainClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log('Filter by domain:', link.domain)
  }

  return (
    <article className="bg-transparent">
      <div className="px-0">
        {/* Header with title and date */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <h2 
            className="text-lg font-semibold line-clamp-2 cursor-pointer hover:underline max-w-[80%] lg:max-w-[61.8%]"
            style={{ color: '#06161a' }}
            title={link.title}
            onClick={onTitleClick}
          >
            {link.title}
          </h2>
          
          {/* Date in top right */}
          <div className="relative">
            <span 
              className="text-xs text-base-content/50 whitespace-nowrap cursor-help"
              onMouseEnter={() => setShowDateTooltip(true)}
              onMouseLeave={() => setShowDateTooltip(false)}
            >
              {formatDate(link.publishedAt)}
            </span>
            
            {/* Date Tooltip */}
            {showDateTooltip && (
              <div className="absolute top-full right-0 mt-1 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap z-10 shadow-lg">
                {formatFullDate(link.publishedAt)}
                {/* Arrow */}
                <div className="absolute bottom-full right-2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-gray-800"></div>
              </div>
            )}
          </div>
        </div>
        
        {/* Domain and Reading Time */}
        <div className="mb-3 relative flex items-center gap-3">
          <button 
            onClick={handleDomainClick}
            onMouseEnter={() => {
              setShowTooltip(true)
              fetchDomainCount()
            }}
            onMouseLeave={() => setShowTooltip(false)}
            className="text-sm transition-colors flex items-center gap-1 relative"
            style={{ 
              color: '#2c5766',
              textDecoration: 'underline',
              textDecorationStyle: 'dashed',
              textUnderlineOffset: '2px'
            }}
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
            </svg>
            {link.domain}
          </button>

          {/* Reading Time */}
          {link.readingTime && (
            <div 
              className="relative"
              onMouseEnter={() => setShowReadingTimeTooltip(true)}
              onMouseLeave={() => setShowReadingTimeTooltip(false)}
            >
              <div className="flex items-center gap-1 text-sm text-base-content/50">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>{formatReadingTime(link.readingTime)}</span>
              </div>
              
              {/* Reading Time Tooltip */}
              {showReadingTimeTooltip && (
                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap z-10 shadow-lg">
                  预估阅读时间:{link.readingTime}分钟
                  {/* Arrow */}
                  <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-800"></div>
                </div>
              )}
            </div>
          )}

          {/* Domain Tooltip */}
          {showTooltip && (
            <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap z-10 shadow-lg">
              {domainCount !== null ? (
                `${domainCount} links from ${link.domain}`
              ) : (
                'Loading...'
              )}
              {/* Arrow */}
              <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-800"></div>
            </div>
          )}
        </div>

        {/* Description */}
        {link.description && (
          <p className="text-base-content/80 text-sm leading-relaxed mb-4 max-w-[80%] lg:max-w-[61.8%]">
            {link.description}
          </p>
        )}

        {/* Footer with category and tags */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category */}
          <CategoryBadge
            category={link.category}
            onClick={() => console.log('Filter by category:', link.category)}
          />

          {/* Tags */}
          <TagList
            tags={link.tags}
            selectedTags={selectedTags}
            onTagClick={onTagClick}
            maxVisible={5}
          />
        </div>
      </div>
    </article>
  )
}