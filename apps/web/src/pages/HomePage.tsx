import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../utils/api'
import NavBar from '../components/NavBar'
import Sidebar from '../components/Sidebar'
import LinkCard from '../components/LinkCard'
import MonthSection from '../components/MonthSection'
import LoadMoreButton from '../components/LoadMoreButton'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

interface Link {
  id: number
  url: string
  title: string
  description: string
  category: string
  tags: string[]
  domain: string
  publishedAt: string
  createdAt: string
}

interface LinksResponse {
  success: boolean
  data: {
    links: Link[]
    pagination: {
      page: number
      limit: number
      total: number
      pages: number
      hasNext: boolean
      hasPrev: boolean
    }
    filters: {
      categories: { name: string; count: number }[]
      tags: { name: string; count: number }[]
      domains: { name: string; count: number }[]
      yearMonths: { year: number; month: number; count: number }[]
    }
  }
}

export default function HomePage() {
  const [page, setPage] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [allLinks, setAllLinks] = useState<Link[]>([])
  const [previousLinks, setPreviousLinks] = useState<Link[]>([])
  const [sidebarData, setSidebarData] = useState<{
    categories: { 
      id: number
      name: string
      slug: string
      icon: string
      color?: string
      description?: string
      displayOrder: number
      count: number
    }[]
    tags: { name: string; count: number }[]
  }>({ categories: [], tags: [] })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // Fetch categories data from new categories API
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.getCategories()
      return response.data
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  // Fetch links data - backend will handle limit from settings
  const { data, isLoading, error, refetch } = useQuery<LinksResponse>({
    queryKey: ['links', page, selectedCategory, selectedTags, searchQuery],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: page.toString()
        // Don't specify limit - let backend use system settings
      }
      
      if (selectedCategory) params.category = selectedCategory
      if (selectedTags.length > 0) params.tags = selectedTags.join(',')
      if (searchQuery) params.search = searchQuery
      
      return await api.getLinks(params)
    },
    keepPreviousData: true, // 保持之前的数据直到新数据加载完成
    staleTime: 1 * 60 * 1000, // 1分钟内认为数据是新鲜的
  })

  // Show previous links during loading to prevent flash
  const displayLinks = (isLoading && page === 1 && previousLinks.length > 0) 
    ? previousLinks 
    : allLinks
  
  // Group links by month
  const groupedLinks = displayLinks.reduce((groups, link) => {
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
  }, {} as Record<string, { year: number; month: number; links: Link[] }>)

  // Update sidebar data by combining categories from categories API with counts from links API
  useEffect(() => {
    if (Array.isArray(categoriesData) && data?.success && data.data.filters) {
      // Preserve existing counts for categories not in the current filter
      // This prevents flash when switching to empty categories
      const existingCategoriesMap = new Map(
        sidebarData.categories.map(cat => [cat.name, cat.count])
      )
      
      // Merge categories from API with count information from links filters
      const categoriesWithCounts = categoriesData.map(category => {
        const categoryFilter = data.data.filters.categories.find(f => f.name === category.name)
        const newCount = categoryFilter?.count || 0
        
        // For non-selected categories, preserve existing count if the new count is 0
        // This prevents visual changes when switching between categories
        const shouldPreserveCount = selectedCategory !== category.name && 
          newCount === 0 && 
          existingCategoriesMap.has(category.name) && 
          existingCategoriesMap.get(category.name)! > 0
        
        return {
          ...category,
          count: shouldPreserveCount ? existingCategoriesMap.get(category.name)! : newCount
        }
      })

      setSidebarData({
        categories: categoriesWithCounts,
        tags: data.data.filters.tags || []
      })
    } else if (Array.isArray(categoriesData) && sidebarData.categories.length === 0) {
      // Only set initial zero counts if sidebar data is empty (first load)
      const categoriesWithZeroCounts = categoriesData.map(category => ({ ...category, count: 0 }))
      
      setSidebarData({
        categories: categoriesWithZeroCounts,
        tags: []
      })
    }
  }, [categoriesData, data?.success, data?.data.filters, selectedCategory, sidebarData.categories])

  // Update links when data changes
  useEffect(() => {
    if (data?.success) {
      if (page === 1) {
        setAllLinks(data.data.links)
      } else {
        // Append for pagination
        setAllLinks(prev => [...prev, ...data.data.links])
      }
    }
  }, [data, page])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
    // Don't clear links immediately to avoid flash
    // setAllLinks([])
  }, [selectedCategory, selectedTags, searchQuery])

  const handleLoadMore = () => {
    if (data?.data.pagination.hasNext) {
      setPage(prev => prev + 1)
    }
  }

  // Helper to preserve links before filtering
  const preserveLinksAndFilter = (action: () => void) => {
    if (allLinks.length > 0) {
      setPreviousLinks(allLinks)
    }
    action()
  }

  const handleCategoryFilter = (category: string | null) => {
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

  // Only show full page loading on initial load (not when filtering)
  if (isLoading && page === 1 && allLinks.length === 0) {
    return (
      <div className="min-h-screen bg-base-100">
        <NavBar onSearch={handleSearch} />
        <div className="container mx-auto px-4">
          <LoadingSpinner />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-base-100">
        <NavBar onSearch={handleSearch} />
        <div className="container mx-auto px-4">
          <div className="alert alert-error">
            <svg className="stroke-current shrink-0 w-6 h-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Failed to load links. Please try again.</span>
            <button className="btn btn-sm" onClick={() => refetch()}>Retry</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base-100">
      <NavBar onSearch={handleSearch} />
      
      {/* Fixed Sidebar - completely fixed to screen */}
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
      
      <div className="lg:ml-80 bg-base-100 min-h-screen">
        {/* Content area with left margin to account for fixed sidebar */}

        {/* Mobile Sidebar Drawer */}
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

        {/* Main Content - scrollable, positioned to right of fixed sidebar */}
        <main className="min-h-screen pt-16">
          <div className="container mx-auto px-4 lg:px-6 py-6">
            {/* Mobile Filter Button - only show when not loading initial data */}
            {!(isLoading && page === 1 && allLinks.length === 0) && (
              <div className="lg:hidden mb-4">
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  className="btn btn-outline btn-sm"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filters
                  {(selectedCategory || selectedTags.length > 0) && (
                    <span className="badge badge-primary badge-sm ml-1">
                      {(selectedCategory ? 1 : 0) + selectedTags.length}
                    </span>
                  )}
                </button>
              </div>
            )}
            
            {/* Show loading overlay when filtering */}
            <div className="relative">
              {/* Show loading overlay only for initial loads, not when filtering */}
              {isLoading && page === 1 && allLinks.length > 0 && previousLinks.length === 0 && (
                <div className="absolute inset-0 bg-base-100/80 backdrop-blur-sm z-10 flex items-center justify-center">
                  <div className="flex items-center gap-2 bg-base-100 px-4 py-2 rounded-lg shadow-sm border border-base-300">
                    <span className="loading loading-spinner loading-sm"></span>
                    <span className="text-sm text-base-content/70">Updating...</span>
                  </div>
                </div>
              )}
              
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

                  {/* Show "No results" message only when filter returns empty and not loading */}
                  {data?.success && allLinks.length === 0 && !isLoading && (selectedCategory || selectedTags.length > 0 || searchQuery) && (
                    <div className="text-center py-12">
                      <div className="text-base-content/60">
                        <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <h3 className="text-lg font-medium mb-2">No results found</h3>
                        <p className="text-sm">Try adjusting your filters or search terms</p>
                      </div>
                    </div>
                  )}

                  {data?.data.pagination.hasNext && !isLoading && (
                    <LoadMoreButton
                      onLoadMore={handleLoadMore}
                      loading={isLoading && page > 1}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}