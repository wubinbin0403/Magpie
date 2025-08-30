import { useState } from 'react'

interface Category {
  name: string
  count: number
}

interface Tag {
  name: string
  count: number
}

interface SidebarProps {
  categories: Category[]
  tags: Tag[]
  selectedCategory: string | null
  selectedTags: string[]
  onCategoryFilter: (category: string | null) => void
  onTagFilter: (tag: string) => void
}

export default function Sidebar({ 
  categories, 
  tags, 
  selectedCategory, 
  selectedTags, 
  onCategoryFilter, 
  onTagFilter 
}: SidebarProps) {
  const [showAllTags, setShowAllTags] = useState(false)
  
  // Get recent activity stats (mock data for now)
  const recentStats = [
    { label: 'This Month', count: 12 },
    { label: 'Last Week', count: 5 },
    { label: 'Today', count: 2 }
  ]

  // Determine which tags to show based on showAllTags state
  const popularTagsToShow = showAllTags ? tags : tags.slice(0, 12)
  const popularTagNames = popularTagsToShow.map(t => t.name)
  
  // Find selected tags that need to be shown but aren't in the visible tags
  const additionalTags: Tag[] = []
  selectedTags.forEach(selectedTag => {
    // If the selected tag is not in the visible tags
    if (!popularTagNames.includes(selectedTag)) {
      // Find it in the full tags list or create a new one
      const tagFromFullList = tags.find(t => t.name === selectedTag)
      if (tagFromFullList) {
        // Tag exists in popular tags but outside visible range
        additionalTags.push(tagFromFullList)
      } else {
        // Tag doesn't exist in popular tags at all
        additionalTags.push({ name: selectedTag, count: 0 })
      }
    }
  })
  
  // Combine the display list
  const displayTags = [...popularTagsToShow, ...additionalTags]

  return (
    <div className="space-y-4">
      {/* Categories Section */}
      <div className="card bg-white shadow-sm border border-slate-200">
        <div className="card-body p-4">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center">
            <svg className="w-4 h-4 mr-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-7H5m14 14H5" />
            </svg>
            Categories
          </h3>
          
          <div className="space-y-1">
            {/* All categories */}
            <button
              onClick={() => onCategoryFilter(null)}
              className={`w-full text-left px-2 py-1 rounded text-sm transition-colors ${
                selectedCategory === null 
                  ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-400' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>All</span>
                <span className="text-xs text-slate-400">
                  {categories.reduce((sum, cat) => sum + cat.count, 0)}
                </span>
              </div>
            </button>
            
            {/* Individual categories */}
            {categories.map((category) => (
              <button
                key={category.name}
                onClick={() => onCategoryFilter(category.name)}
                className={`w-full text-left px-2 py-1 rounded text-sm transition-colors ${
                  selectedCategory === category.name 
                    ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-400' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{category.name}</span>
                  <span className="text-xs text-slate-400">{category.count}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Popular Tags */}
      <div className="card bg-white shadow-sm border border-slate-200">
        <div className="card-body p-4">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center">
            <svg className="w-4 h-4 mr-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Popular Tags
          </h3>
          
          <div className={`flex flex-wrap gap-1 transition-all duration-300 ${
            showAllTags 
              ? 'max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent' 
              : ''
          }`}>
            {displayTags.map((tag) => (
              <button
                key={tag.name}
                onClick={() => onTagFilter(tag.name)}
                className={`inline-flex items-center px-2 py-1 rounded text-xs border transition-colors ${
                  selectedTags.includes(tag.name)
                    ? 'bg-primary/20 text-primary border-primary/50 font-semibold'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                #{tag.name}
                {tag.count > 0 && (
                  <span className={`ml-1 ${selectedTags.includes(tag.name) ? 'text-primary' : 'text-slate-400'}`}>
                    {tag.count}
                  </span>
                )}
                {tag.count === 0 && selectedTags.includes(tag.name) && (
                  <span className="ml-1 text-xs text-primary">•</span>
                )}
              </button>
            ))}
          </div>
          
          {tags.length > 12 && (
            <div className="flex justify-center mt-2">
              <button 
                onClick={() => setShowAllTags(!showAllTags)}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
              >
                <span className="text-base leading-none">{showAllTags ? '−' : '+'}</span>
                <span>{showAllTags ? '收起标签' : '显示所有'}</span>
              </button>
            </div>
          )}
          
          {/* Recent stats as one line */}
          <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500 text-center">
            Today: <span style={{ color: '#127176' }}>{recentStats.find(s => s.label === 'Today')?.count || 0}</span>, This Week: <span style={{ color: '#127176' }}>{recentStats.find(s => s.label === 'Last Week')?.count || 0}</span>, Month: <span style={{ color: '#127176' }}>{recentStats.find(s => s.label === 'This Month')?.count || 0}</span>
          </div>
        </div>
      </div>

    </div>
  )
}