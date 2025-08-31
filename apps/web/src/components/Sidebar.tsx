import React, { useState, memo } from 'react'
import CategoryIcon from './CategoryIcon'

interface Category {
  id: number
  name: string
  slug: string
  icon: string
  color?: string
  description?: string
  displayOrder: number
  count?: number // Will be added dynamically from links API
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

const Sidebar = memo(function Sidebar({ 
  categories, 
  tags, 
  selectedCategory, 
  selectedTags, 
  onCategoryFilter, 
  onTagFilter
}: SidebarProps) {
  const [showAllTags, setShowAllTags] = useState(false)
  const [hoverAnimations, setHoverAnimations] = useState<{[key: string]: string}>({})
  

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

  // Get category icon with animation
  const getCategoryIcon = (category: Category, animationClass: string) => {
    return (
      <CategoryIcon 
        icon={category.icon} 
        className={`w-full h-full transition-transform duration-500 ${animationClass}`}
      />
    )
  }
  
  // Get "All" category icon
  const getAllCategoryIcon = (animationClass: string) => {
    return (
      <CategoryIcon 
        icon="folder" 
        className={`w-full h-full transition-transform duration-500 ${animationClass}`}
      />
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
                  {getAllCategoryIcon(getCategoryAnimation('All'))}
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
          
          {/* Individual categories - only show categories with count > 0 */}
          {categories.filter(category => category.count > 0).map((category) => (
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
                    {getCategoryIcon(category, getCategoryAnimation(category.name))}
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
          </div>
        </div>
      </div>

    </div>
  )
})

export default Sidebar