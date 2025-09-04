interface CategoryBadgeProps {
  category: string
  onClick?: (category: string) => void
  className?: string
}

export default function CategoryBadge({ category, onClick, className = '' }: CategoryBadgeProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onClick) {
      onClick(category)
    }
  }

  const baseClassName = "inline-flex items-center px-2 py-1 bg-accent/20 hover:bg-accent/30 text-secondary text-xs font-medium rounded transition-colors border border-transparent"
  
  return (
    <button
      onClick={handleClick}
      className={`${baseClassName} ${className}`}
    >
      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-7H5m14 14H5" />
      </svg>
      {category}
    </button>
  )
}