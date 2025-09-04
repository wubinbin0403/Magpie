interface TagBadgeProps {
  tag: string
  isSelected?: boolean
  onClick?: (tag: string) => void
  className?: string
}

export default function TagBadge({ tag, isSelected = false, onClick, className = '' }: TagBadgeProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onClick) {
      onClick(tag)
    }
  }

  const baseClassName = `inline-flex items-center px-2 py-1 text-xs rounded transition-colors border ${
    isSelected
      ? 'bg-primary/30 text-primary font-semibold border-primary/50'
      : 'bg-primary/10 hover:bg-primary/20 text-primary border-transparent'
  }`
  
  return (
    <button
      onClick={handleClick}
      className={`${baseClassName} ${className}`}
    >
      #{tag}
    </button>
  )
}