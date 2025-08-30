import React, { useState } from 'react'

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
  const [hoverAnimations, setHoverAnimations] = useState<{[key: string]: string}>({})
  
  // Get recent activity stats (mock data for now)
  const recentStats = [
    { label: 'This Month', count: 12 },
    { label: 'Last Week', count: 5 },
    { label: 'Today', count: 2 }
  ]

  // Random animation effects
  const animations = [
    'group-hover:scale-110 group-hover:rotate-45',
    'group-hover:scale-125 group-hover:rotate-12', 
    'group-hover:scale-105 group-hover:rotate-90 group-hover:skew-x-6',
    'group-hover:scale-115 group-hover:-rotate-12 group-hover:animate-pulse',
    'group-hover:scale-120 group-hover:rotate-180',
    'group-hover:scale-105 group-hover:rotate-45 group-hover:skew-y-3'
  ]
  
  const handleCategoryHover = (categoryKey: string) => {
    const randomAnimation = animations[Math.floor(Math.random() * animations.length)]
    setHoverAnimations(prev => ({ ...prev, [categoryKey]: randomAnimation }))
  }
  
  const getCategoryAnimation = (categoryKey: string) => {
    return hoverAnimations[categoryKey] || animations[0]
  }

  // Category icon mapping
  const getCategoryIcon = (categoryName: string) => {
    const iconMap: { [key: string]: JSX.Element } = {
      '技术': (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110 group-hover:rotate-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      ),
      '产品': (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110 group-hover:rotate-12" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2L3 6v8l7 4 7-4V6l-7-4zM10 4.618l4.5 2.571L10 9.764 5.5 7.189 10 4.618zM5 8.618l4 2.286v5.714L5 14.332V8.618zm6 8l4-2.286V8.618L11 10.904v5.714z"/>
        </svg>
      ),
      '设计': (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110 group-hover:-rotate-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      ),
      '工具': (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110 group-hover:rotate-45" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
      ),
      'All': (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110 group-hover:rotate-180" fill="currentColor" viewBox="0 0 20 20">
          <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
        </svg>
      )
    }
    
    return iconMap[categoryName] || (
      <svg className="w-5 h-5 transition-transform group-hover:scale-110 group-hover:rotate-12" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clipRule="evenodd" />
      </svg>
    )
  }

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
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-4">
        {/* Categories Section */}
        <div className="grid grid-cols-2 gap-3">
          {/* All categories */}
          <button
            onClick={() => onCategoryFilter(null)}
            onMouseEnter={() => handleCategoryHover('All')}
            className={`group relative p-4 rounded-xl transition-all duration-300 hover:shadow-sm ${
              selectedCategory === null 
                ? 'bg-magpie-200/10' 
                : 'hover:bg-magpie-200/5'
            }`}
          >
            {/* Large background icon */}
            <div className="absolute top-1 left-1 w-12 h-12 flex items-center justify-center">
              <div className={`transition-all duration-300 ${
                selectedCategory === null 
                  ? 'text-magpie-200/25' 
                  : 'text-gray-400/20 group-hover:text-magpie-200/22'
              }`}>
                <div className="w-10 h-10 flex items-center justify-center">
                  {React.cloneElement(getCategoryIcon('All'), { 
                    className: `w-full h-full transition-transform duration-500 ${getCategoryAnimation('All')}` 
                  })}
                </div>
              </div>
            </div>
            
            {/* Count in top-right corner */}
            <div className="absolute top-2 right-2 z-10">
              <span className={`text-xs font-medium transition-colors duration-300 ${
                selectedCategory === null 
                  ? 'text-magpie-200' 
                  : 'text-gray-400 group-hover:text-magpie-200'
              }`}>
                {categories.reduce((sum, cat) => sum + cat.count, 0)}
              </span>
            </div>
            
            {/* Category title centered */}
            <div className="relative z-10 flex items-center justify-center min-h-[50px]">
              <div className={`text-lg font-bold transition-colors duration-300 ${
                selectedCategory === null 
                  ? 'text-magpie-300' 
                  : 'text-gray-800 group-hover:text-magpie-300'
              }`}>
                All
              </div>
            </div>
          </button>
          
          {/* Individual categories */}
          {categories.map((category) => (
            <button
              key={category.name}
              onClick={() => onCategoryFilter(category.name)}
              onMouseEnter={() => handleCategoryHover(category.name)}
              className={`group relative p-4 rounded-xl transition-all duration-300 hover:shadow-sm ${
                selectedCategory === category.name 
                  ? 'bg-magpie-200/10' 
                  : 'hover:bg-magpie-200/5'
              }`}
            >
              {/* Large background icon */}
              <div className="absolute top-1 left-1 w-12 h-12 flex items-center justify-center">
                <div className={`transition-all duration-300 ${
                  selectedCategory === category.name 
                    ? 'text-magpie-200/25' 
                    : 'text-gray-400/20 group-hover:text-magpie-200/22'
                }`}>
                  <div className="w-10 h-10 flex items-center justify-center">
                    {React.cloneElement(getCategoryIcon(category.name), { 
                      className: `w-full h-full transition-transform duration-500 ${getCategoryAnimation(category.name)}` 
                    })}
                  </div>
                </div>
              </div>
              
              {/* Count in top-right corner */}
              <div className="absolute top-2 right-2 z-10">
                <span className={`text-xs font-medium transition-colors duration-300 ${
                  selectedCategory === category.name 
                    ? 'text-magpie-200' 
                    : 'text-gray-400 group-hover:text-magpie-200'
                }`}>
                  {category.count}
                </span>
              </div>
              
              {/* Category title centered */}
              <div className="relative z-10 flex items-center justify-center min-h-[50px]">
                <div className={`text-lg font-bold transition-colors duration-300 ${
                  selectedCategory === category.name 
                    ? 'text-magpie-300' 
                    : 'text-gray-800 group-hover:text-magpie-300'
                }`}>
                  {category.name}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Popular Tags - moved to bottom */}
      <div className="mt-6">
        <div className="bg-slate-50/50 rounded-lg border border-slate-100">
          <div className="p-3">
            <h3 className="text-sm font-medium text-slate-500 mb-3 flex items-center">
              <svg className="w-3 h-3 mr-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              热门标签
            </h3>
            
            <div className={`flex flex-wrap gap-1 transition-all duration-300 ${
              showAllTags 
                ? 'max-h-64 overflow-y-auto scrollbar-none' 
                : ''
            }`}>
              {displayTags.map((tag) => (
                <button
                  key={tag.name}
                  onClick={() => onTagFilter(tag.name)}
                  className={`inline-flex items-center px-2 py-1 rounded text-xs border transition-colors ${
                    selectedTags.includes(tag.name)
                      ? 'bg-primary/15 text-primary border-primary/30 font-medium'
                      : 'bg-white/80 text-slate-500 border-slate-200/80 hover:bg-white hover:text-slate-600'
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
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                >
                  <span className="text-base leading-none">{showAllTags ? '−' : '+'}</span>
                  <span>{showAllTags ? '收起标签' : '显示所有'}</span>
                </button>
              </div>
            )}
            
            {/* Recent stats as one line */}
            <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500 text-center">
              新增条目 - 今天: <span style={{ color: '#127176' }}>{recentStats.find(s => s.label === 'Today')?.count || 0}</span> | 本周: <span style={{ color: '#127176' }}>{recentStats.find(s => s.label === 'Last Week')?.count || 0}</span> | 本月: <span style={{ color: '#127176' }}>{recentStats.find(s => s.label === 'This Month')?.count || 0}</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}