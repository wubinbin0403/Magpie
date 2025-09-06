import * as HeroIcons from '@heroicons/react/24/outline'
import { useMemo } from 'react'

interface CategoryIconProps {
  icon: string
  className?: string
  style?: React.CSSProperties
}

export default function CategoryIcon({ icon, className = "w-5 h-5", style }: CategoryIconProps) {
  const IconComponent = useMemo(() => {
    // Convert kebab-case to PascalCase + Icon (e.g., "paint-brush" -> "PaintBrushIcon")
    const iconName = icon
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('') + 'Icon'
    
    // Try to get the icon from HeroIcons
    const IconFromHero = (HeroIcons as any)[iconName]
    
    return IconFromHero || HeroIcons.FolderIcon
  }, [icon])

  return <IconComponent className={className} style={style} />
}