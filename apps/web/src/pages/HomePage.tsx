import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import NavBar from '../components/NavBar'
import Sidebar from '../components/Sidebar'
import LinkCard from '../components/LinkCard'
import MonthSection from '../components/MonthSection'
import EmptyState from '../components/EmptyState'
import LoadMoreButton from '../components/LoadMoreButton'
import { useHomePageData } from '../hooks/useHomePageData'
import { useSidebarData } from '../hooks/useSidebarData'
import type { Link } from '@magpie/shared'

interface MonthGroup {
  year: number
  month: number
  links: Link[]
}

// 简化后的HomePage组件
export default function HomePage() {
  const { id: linkId, name: categoryName } = useParams<{ id?: string; name?: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // 筛选和分页状态
  const [page, setPage] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // 更新URL参数的统一函数
  const updateURLParams = (newParams: { 
    category?: string | null
    tags?: string[]
    search?: string
  }) => {
    const params = new URLSearchParams(searchParams)
    
    // 更新分类参数
    if (newParams.category !== undefined) {
      if (newParams.category) {
        params.set('category', newParams.category)
      } else {
        params.delete('category')
      }
    }
    
    // 更新标签参数
    if (newParams.tags !== undefined) {
      if (newParams.tags.length > 0) {
        // 支持多个标签，使用逗号分隔
        params.set('tags', newParams.tags.join(','))
      } else {
        params.delete('tags')
      }
    }
    
    // 更新搜索参数
    if (newParams.search !== undefined) {
      if (newParams.search.trim()) {
        params.set('search', newParams.search.trim())
      } else {
        params.delete('search')
      }
    }
    
    setSearchParams(params, { replace: true })
  }

  // 从URL参数初始化筛选状态
  useEffect(() => {
    if (categoryName) {
      // 如果是分类路由 /category/:name，设置选中的分类
      const decodedCategory = decodeURIComponent(categoryName)
      setSelectedCategory(decodedCategory)
    } else if (!linkId) {
      // 如果是首页路由，从查询参数获取筛选条件
      const categoryParam = searchParams.get('category')
      const tagsParam = searchParams.get('tags')
      const searchParam = searchParams.get('search')
      
      if (categoryParam) setSelectedCategory(categoryParam)
      if (tagsParam) {
        // 支持多个标签，从逗号分隔的字符串解析，限制最多5个
        const parsedTags = tagsParam.split(',').map(tag => tag.trim()).filter(tag => tag).slice(0, 5)
        setSelectedTags(parsedTags)
      }
      if (searchParam) setSearchQuery(searchParam)
    }
  }, [linkId, categoryName, searchParams])

  // 数据获取，如果有linkId就将其作为搜索条件
  const { 
    data, 
    isLoading, 
    error, 
    refetch, 
    displayLinks, 
    preserveLinksAndFilter 
  } = useHomePageData(page, selectedCategory, selectedTags, searchQuery, true, linkId)

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
    
    // 如果当前在ID搜索模式，跳转到首页并设置分类筛选
    if (linkId) {
      const params = new URLSearchParams()
      if (category) params.set('category', category)
      navigate(`/?${params.toString()}`)
      return
    }
    
    preserveLinksAndFilter(() => {
      setSelectedCategory(category)
      updateURLParams({ category })
    })
  }

  const handleTagFilter = (tag: string) => {
    // 如果当前在ID搜索模式，跳转到首页并设置标签筛选
    if (linkId) {
      const params = new URLSearchParams()
      params.set('tags', tag)
      navigate(`/?${params.toString()}`)
      return
    }
    
    preserveLinksAndFilter(() => {
      const newTags = selectedTags.includes(tag) 
        ? selectedTags.filter(t => t !== tag)
        : selectedTags.length < 5 ? [...selectedTags, tag] : selectedTags // 限制最多5个标签
      
      setSelectedTags(newTags)
      updateURLParams({ tags: newTags })
    })
  }

  const handleSearch = (query: string) => {
    // 如果当前在ID搜索模式，跳转到首页并设置搜索查询
    if (linkId) {
      const params = new URLSearchParams()
      if (query.trim()) params.set('search', query.trim())
      navigate(`/?${params.toString()}`)
      return
    }
    
    preserveLinksAndFilter(() => {
      setSearchQuery(query)
      updateURLParams({ search: query })
    })
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
              // 链接列表模式（支持列表和按ID搜索显示）
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

                {/* 加载更多按钮，只在非ID搜索模式时显示 */}
                {!linkId && data?.data.pagination.hasNext && (
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