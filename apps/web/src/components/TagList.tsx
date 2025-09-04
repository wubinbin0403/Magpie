import { useState } from 'react'
import TagBadge from './TagBadge'

interface TagListProps {
  tags: string[]
  selectedTags?: string[]
  onTagClick?: (tag: string) => void
  maxVisible?: number
  className?: string
}

export default function TagList({ 
  tags = [], 
  selectedTags = [], 
  onTagClick, 
  maxVisible = 5,
  className = '' 
}: TagListProps) {
  const [showTagsTooltip, setShowTagsTooltip] = useState(false)

  const handleTagClick = (tag: string) => {
    if (onTagClick) {
      onTagClick(tag)
    }
  }

  // Handle empty or undefined tags
  if (!tags || tags.length === 0) {
    return <div className={`flex flex-wrap items-center gap-2 ${className}`} />
  }

  const visibleTags = tags.slice(0, maxVisible)
  const remainingTags = tags.slice(maxVisible)
  const hasMoreTags = remainingTags.length > 0

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Visible tags */}
      {visibleTags.map((tag) => (
        <TagBadge
          key={tag}
          tag={tag}
          isSelected={selectedTags.includes(tag)}
          onClick={handleTagClick}
        />
      ))}

      {/* More tags indicator with tooltip */}
      {hasMoreTags && (
        <div 
          className="relative"
          onMouseEnter={() => setShowTagsTooltip(true)}
          onMouseLeave={() => setShowTagsTooltip(false)}
        >
          <span className="text-xs text-base-content/40 cursor-pointer hover:text-base-content/60 transition-colors">
            +{remainingTags.length} more
          </span>
          
          {/* Tags Tooltip */}
          {showTagsTooltip && (
            <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap z-20 shadow-lg">
              <div className="flex flex-wrap gap-1">
                {remainingTags.map((tag) => (
                  <TagBadge
                    key={tag}
                    tag={tag}
                    isSelected={selectedTags.includes(tag)}
                    onClick={handleTagClick}
                    className={`${
                      selectedTags.includes(tag)
                        ? 'bg-primary/80 text-white font-semibold border-primary'
                        : 'bg-gray-600 hover:bg-gray-500 text-white border-transparent'
                    }`}
                  />
                ))}
              </div>
              {/* Arrow */}
              <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-800"></div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}