import * as HeroIcons from '@heroicons/react/24/outline'
import { useMemo } from 'react'

interface CategoryIconProps {
  icon: string
  className?: string
  style?: React.CSSProperties
}

export default function CategoryIcon({ icon, className = "w-5 h-5", style }: CategoryIconProps) {
  const IconComponent = useMemo(() => {
    // First try common alias mappings for convenience
    const aliasMappings: { [key: string]: string } = {
      'code': 'CodeBracketIcon',
      'book': 'BookOpenIcon',
      'news': 'NewspaperIcon',
      'video': 'VideoCameraIcon',
      'music': 'MusicalNoteIcon',
      'image': 'PhotoIcon',
      'web': 'GlobeAltIcon',
      'tech': 'CpuChipIcon',
      'business': 'BuildingOffice2Icon',
      'shopping': 'ShoppingBagIcon',
      'game': 'PuzzlePieceIcon',
      'education': 'AcademicCapIcon',
      'finance': 'BanknotesIcon',
      'tool': 'WrenchScrewdriverIcon',
      'email': 'EnvelopeIcon',
      'mail': 'EnvelopeIcon',
      'location': 'MapPinIcon',
      'search': 'MagnifyingGlassIcon',
      'settings': 'Cog6ToothIcon',
      'edit': 'PencilIcon',
      'trash': 'TrashIcon',
      'shield': 'ShieldCheckIcon',
      'lock': 'LockClosedIcon',
      'chat': 'ChatBubbleLeftRightIcon',
      'terminal': 'CommandLineIcon',
      'document': 'DocumentTextIcon',
      'science': 'BeakerIcon'
    }

    // Try alias first
    let iconName = aliasMappings[icon.toLowerCase()]
    
    // If no alias, convert kebab-case to PascalCase + Icon
    if (!iconName) {
      iconName = icon
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('') + 'Icon'
    }
    
    // Try to get the icon from HeroIcons
    const IconFromHero = (HeroIcons as any)[iconName]
    
    return IconFromHero || HeroIcons.FolderIcon
  }, [icon])

  return <IconComponent className={className} style={style} />
}