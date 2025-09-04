import { useState, useEffect, useMemo } from 'react'
import NavBar from '../components/NavBar'
import Sidebar from '../components/Sidebar'
import LinkCard from '../components/LinkCard'
import MonthSection from '../components/MonthSection'
import EmptyState from '../components/EmptyState'
import LoadMoreButton from '../components/LoadMoreButton'
import { useHomePageData } from '../hooks/useHomePageData'
import { useSidebarData } from '../hooks/useSidebarData'
// Link 接口定义  
interface Link {
  id: number
  title: string
  url: string
  description: string
  publishedAt: string
  category: string
  tags: string[]
  domain: string
  readingTime?: number // AI estimated reading time in minutes
}

interface MonthGroup {
  year: number
  month: number
  links: Link[]
}

// 简化后的HomePage组件
export default function HomePage() {
  // 筛选和分页状态
  const [page, setPage] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // 自定义Hook处理数据获取
  const { 
    data, 
    isLoading, 
    error, 
    refetch, 
    displayLinks, 
    preserveLinksAndFilter 
  } = useHomePageData(page, selectedCategory, selectedTags, searchQuery)

  // 自定义Hook处理sidebar数据
  const { sidebarData } = useSidebarData(selectedCategory, data)

  // 使用useMemo优化分组计算
  const groupedLinks = useMemo(() => {
    return displayLinks.reduce((groups, link) => {
      const date = new Date(link.publishedAt)
      const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
      
      if (!groups[key]) {
        groups[key] = {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          links: []
        }
      }
      
      groups[key].links.push(link)
      return groups
    }, {} as Record<string, MonthGroup>)
  }, [displayLinks])

  // 筛选变化时重置页面
  useEffect(() => {
    setPage(1)
  }, [selectedCategory, selectedTags, searchQuery])

  // 事件处理函数
  const handleCategoryFilter = (category: string | null) => {
    if (category === selectedCategory) return
    preserveLinksAndFilter(() => setSelectedCategory(category))
  }

  const handleTagFilter = (tag: string) => {
    preserveLinksAndFilter(() => 
      setSelectedTags(prev => 
        prev.includes(tag) 
          ? prev.filter(t => t !== tag)
          : [...prev, tag]
      )
    )
  }

  const handleSearch = (query: string) => {
    preserveLinksAndFilter(() => setSearchQuery(query))
  }

  const handleLoadMore = () => {
    if (data?.data.pagination.hasNext) {
      setPage(prev => prev + 1)
    }
  }

  // 初始加载状态
  if (isLoading && displayLinks.length === 0 && !data) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <span 
          className="loading loading-spinner loading-lg"
          data-testid="loading-spinner"
        ></span>
      </div>
    )
  }

  // 错误状态
  if (error && displayLinks.length === 0) {
    return (
      <div className="min-h-screen bg-base-100">
        <NavBar 
          onSearch={handleSearch}
        />
        
        <div className="flex flex-col items-center justify-center gap-4 pt-20">
          <div className="text-error text-lg">加载失败</div>
          <button 
            onClick={() => refetch()} 
            className="btn btn-outline btn-sm"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base-100">
      <NavBar 
        onSearch={handleSearch}
      />
      
      {/* 桌面端侧边栏 */}
      <aside className="hidden lg:block fixed left-0 top-16 bottom-0 w-80 bg-base-200/30 overflow-y-auto scrollbar-none z-40">
        <div className="p-6 h-full">
          <Sidebar
            categories={sidebarData.categories}
            tags={sidebarData.tags}
            selectedCategory={selectedCategory}
            selectedTags={selectedTags}
            onCategoryFilter={handleCategoryFilter}
            onTagFilter={handleTagFilter}
          />
        </div>
      </aside>
      
      {/* 移动端侧边栏 */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/20" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="relative w-80 bg-base-200/30 shadow-xl overflow-y-auto scrollbar-none h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-base-300/50">
              <h2 className="text-lg font-semibold text-base-content">Filters</h2>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="btn btn-ghost btn-sm btn-square"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 flex-1">
              <Sidebar
                categories={sidebarData.categories}
                tags={sidebarData.tags}
                selectedCategory={selectedCategory}
                selectedTags={selectedTags}
                onCategoryFilter={handleCategoryFilter}
                onTagFilter={handleTagFilter}
              />
            </div>
          </aside>
        </div>
      )}
      
      <div className="lg:ml-80 bg-base-100 min-h-screen">
        {/* Main Content - scrollable, positioned to right of fixed sidebar */}
        <main className="min-h-screen pt-16">
          <div className="container mx-auto px-4 lg:px-6 py-6">
            {displayLinks.length === 0 && !isLoading && !data ? (
              <EmptyState />
            ) : (
              <div className="space-y-8">
                {displayLinks.length > 0 && Object.entries(groupedLinks)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([key, group]) => (
                    <MonthSection
                      key={key}
                      year={group.year}
                      month={group.month}
                      count={group.links.length}
                    >
                      <div className="divide-y divide-base-300/10">
                        {group.links.map(link => (
                          <div 
                            key={link.id} 
                            className="group hover:bg-base-200/30 transition-colors duration-1000 ease-in-out -mx-4 lg:-mx-6 px-4 lg:px-6 py-4"
                          >
                            <LinkCard 
                              link={link}
                              onTitleClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                              onTagClick={handleTagFilter}
                              selectedTags={selectedTags}
                            />
                          </div>
                        ))}
                      </div>
                    </MonthSection>
                  ))}

                {/* 加载更多按钮 */}
                {data?.data.pagination.hasNext && (
                  <LoadMoreButton
                    onLoadMore={handleLoadMore}
                    loading={isLoading && page > 1}
                  />
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}