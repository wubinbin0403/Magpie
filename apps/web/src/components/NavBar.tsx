import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import CategoryIcon from './CategoryIcon'

interface Category {
  id: number
  name: string
  slug: string
  icon: string
  color?: string
  description?: string
  displayOrder: number
  count?: number
}

interface NavBarProps {
  onSearch: (query: string) => void
  onLogoClick?: () => void
  initialSearchQuery?: string
  categories?: Category[]
  selectedCategory?: string | null
  onCategoryFilter?: (category: string | null) => void
}

export default function NavBar({ 
  onSearch, 
  onLogoClick, 
  initialSearchQuery = '',
  categories = [],
  selectedCategory,
  onCategoryFilter
}: NavBarProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const mobileSearchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Sync search query when initialSearchQuery changes
  useEffect(() => {
    setSearchQuery(initialSearchQuery)
  }, [initialSearchQuery])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(searchQuery)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    // Real-time search with debounce could be implemented here
  }

  const handleMobileSearchToggle = () => {
    setIsMobileSearchOpen(!isMobileSearchOpen)
    // Focus the mobile search input when opening
    if (!isMobileSearchOpen) {
      setTimeout(() => {
        mobileSearchInputRef.current?.focus()
      }, 100)
    }
  }

  const handleMobileSearch = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(searchQuery)
    setIsMobileSearchOpen(false) // Close search after submitting
  }

  // Close dropdown menu
  const closeDropdown = () => {
    if (dropdownRef.current) {
      // Remove focus from the dropdown button to close it
      const activeElement = document.activeElement as HTMLElement
      activeElement?.blur()
    }
  }

  // Handle category selection in mobile menu
  const handleMobileCategorySelect = (category: string | null) => {
    onCategoryFilter?.(category)
    closeDropdown()
  }

  // Handle Cmd+K / Ctrl+K keyboard shortcut and ESC to blur
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (document.activeElement === searchInputRef.current) {
          // If search is already focused, blur it
          searchInputRef.current?.blur()
        } else {
          // If search is not focused, focus it
          searchInputRef.current?.focus()
        }
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        e.preventDefault()
        searchInputRef.current?.blur()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Magpie-inspired color scheme (black, white, blue accents)
  return (
    <div data-testid="navbar">
      {/* Main Navigation Bar */}
      <div 
        className="navbar text-white shadow-lg fixed top-0 left-0 right-0 z-[55]" 
        style={{ backgroundColor: '#127176' }}
      >
        <div className="w-full flex items-center justify-between px-4 lg:px-6">
          
          {/* Mobile Layout */}
          <div className="lg:hidden w-full flex items-center justify-between">
            {/* Left: Mobile menu button */}
            <div className="dropdown" ref={dropdownRef}>
              <div tabIndex={0} role="button" className="btn btn-ghost btn-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </div>
              <div className="dropdown-content mt-3 z-[70] p-4 shadow-lg bg-white rounded-lg border border-slate-200 w-80">
                {/* Categories Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* All categories */}
                  <button
                    onClick={() => handleMobileCategorySelect(null)}
                    className={`group relative p-3 rounded-lg transition-all duration-300 hover:shadow-sm ${
                      selectedCategory === null 
                        ? 'bg-magpie-200/10' 
                        : 'hover:bg-magpie-200/5'
                    }`}
                  >
                    {/* Large background icon */}
                    <div className="absolute top-1 left-1 w-10 h-10 flex items-center justify-center">
                      <div className={`transition-all duration-300 ${
                        selectedCategory === null 
                          ? 'text-magpie-200/25' 
                          : 'text-gray-400/20 group-hover:text-magpie-200/22'
                      }`}>
                        <div className="w-8 h-8 flex items-center justify-center">
                          <CategoryIcon 
                            icon="folder" 
                            className="w-full h-full transition-transform duration-500 group-hover:scale-110 group-hover:rotate-45"
                          />
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
                        {categories.reduce((sum, cat) => sum + (cat.count ?? 0), 0)}
                      </span>
                    </div>
                    
                    {/* Category title centered */}
                    <div className="relative z-10 flex items-center justify-center min-h-[40px]">
                      <div className={`text-sm font-bold transition-colors duration-300 ${
                        selectedCategory === null 
                          ? 'text-magpie-300' 
                          : 'text-gray-800 group-hover:text-magpie-300'
                      }`}>
                        All
                      </div>
                    </div>
                  </button>
                  
                  {/* Individual categories - only show categories with count > 0 */}
                  {categories.filter(category => (category.count ?? 0) > 0).map((category) => (
                    <button
                      key={category.name}
                      onClick={() => handleMobileCategorySelect(category.name)}
                      className={`group relative p-3 rounded-lg transition-all duration-300 hover:shadow-sm ${
                        selectedCategory === category.name 
                          ? 'bg-magpie-200/10' 
                          : 'hover:bg-magpie-200/5'
                      }`}
                    >
                      {/* Large background icon */}
                      <div className="absolute top-1 left-1 w-10 h-10 flex items-center justify-center">
                        <div className={`transition-all duration-300 ${
                          selectedCategory === category.name 
                            ? 'text-magpie-200/25' 
                            : 'text-gray-400/20 group-hover:text-magpie-200/22'
                        }`}>
                          <div className="w-8 h-8 flex items-center justify-center">
                            <CategoryIcon 
                              icon={category.icon} 
                              className="w-full h-full transition-transform duration-500 group-hover:scale-110 group-hover:rotate-45"
                            />
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
                          {category.count ?? 0}
                        </span>
                      </div>
                      
                      {/* Category title centered */}
                      <div className="relative z-10 flex items-center justify-center min-h-[40px]">
                        <div className={`text-sm font-bold transition-colors duration-300 ${
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
            </div>

            {/* Center: Logo */}
            <div className="flex-1 flex justify-center">
              {onLogoClick ? (
                <button onClick={onLogoClick} className="btn btn-ghost hover:bg-white/10 group">
                  <div className="flex items-center gap-2">
                    <img 
                      src="/magpie-icon.png" 
                      alt="Magpie" 
                      className="h-8 max-w-8 object-contain transition-transform duration-500 group-hover:[transform:rotateY(180deg)]"
                      style={{ transformStyle: 'preserve-3d' }}
                    />
                    <span className="text-white text-lg font-bold">Magpie</span>
                  </div>
                </button>
              ) : (
                <Link to="/" className="btn btn-ghost hover:bg-white/10 group">
                  <div className="flex items-center gap-2">
                    <img 
                      src="/magpie-icon.png" 
                      alt="Magpie" 
                      className="h-8 max-w-8 object-contain transition-transform duration-500 group-hover:[transform:rotateY(180deg)]"
                      style={{ transformStyle: 'preserve-3d' }}
                    />
                    <span className="text-white text-lg font-bold">Magpie</span>
                  </div>
                </Link>
              )}
            </div>

            {/* Right: Search button */}
            <button 
              onClick={handleMobileSearchToggle}
              className="btn btn-ghost btn-sm hover:bg-white/10"
              title="搜索"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>

          {/* Desktop Layout */}
          <div className="hidden lg:flex w-full items-center justify-between">
            {/* Left side - Logo */}
            <div className="flex items-center">
              {onLogoClick ? (
                <button onClick={onLogoClick} className="btn btn-ghost hover:bg-white/10 group">
                  <div className="flex items-center gap-2">
                    <img 
                      src="/magpie-icon.png" 
                      alt="Magpie" 
                      className="h-10 max-w-10 object-contain transition-transform duration-500 group-hover:[transform:rotateY(180deg)]"
                      style={{ transformStyle: 'preserve-3d' }}
                    />
                    <span className="text-white text-xl font-bold">Magpie</span>
                  </div>
                </button>
              ) : (
                <Link to="/" className="btn btn-ghost hover:bg-white/10 group">
                  <div className="flex items-center gap-2">
                    <img 
                      src="/magpie-icon.png" 
                      alt="Magpie" 
                      className="h-10 max-w-10 object-contain transition-transform duration-500 group-hover:[transform:rotateY(180deg)]"
                      style={{ transformStyle: 'preserve-3d' }}
                    />
                    <span className="text-white text-xl font-bold">Magpie</span>
                  </div>
                </Link>
              )}
            </div>

            {/* Right side - Search and buttons */}
            <div className="flex items-center gap-2">
              {/* Desktop Search form */}
              <form onSubmit={handleSearch} className="relative">
                <div className="form-control">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="搜索链接..."
                    className={`input input-sm bg-white/10 border-white/20 text-white placeholder-white/60 focus:border-white/40 focus:bg-white/15 transition-all duration-200 w-48 ${
                      isSearchFocused ? 'w-64' : ''
                    }`}
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                  />
                </div>
                
                {/* Search keyboard shortcut hint */}
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-white/50 pointer-events-none">
                  {isSearchFocused ? '↵' : '⌘K'}
                </div>
              </form>

              {/* Archive button */}
              <Link 
                to="/search" 
                className="btn btn-ghost btn-sm hover:bg-white/10"
                title="Archive"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </Link>

              {/* More menu */}
              <div className="dropdown dropdown-end">
                <div tabIndex={0} role="button" className="btn btn-ghost btn-sm hover:bg-white/10">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <ul className="dropdown-content z-[70] menu p-2 shadow-lg bg-white rounded-lg w-48 border border-slate-200 mt-2">
                  <li>
                    <a 
                      href="/feed.xml" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md"
                    >
                      <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
                      </svg>
                      订阅RSS (XML)
                    </a>
                  </li>
                  <li>
                    <a 
                      href="/feed.json" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md"
                    >
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      订阅Feed (JSON)
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Search Overlay */}
      {isMobileSearchOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-[45] bg-black bg-opacity-50"
          onClick={() => setIsMobileSearchOpen(false)}
        />
      )}

      {/* Mobile Search Bar */}
      <div 
        className={`lg:hidden fixed top-16 left-0 right-0 z-[60] transition-all duration-300 ease-in-out ${
          isMobileSearchOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
        style={{ backgroundColor: '#127176' }}
      >
        <div className="px-4 py-3 border-t border-white/20">
          <form onSubmit={handleMobileSearch} className="relative">
            <input
              ref={mobileSearchInputRef}
              type="text"
              placeholder="搜索链接..."
              className="w-full input input-sm bg-white/10 border-white/20 text-white placeholder-white/60 focus:border-white/40 focus:bg-white/15 pr-10"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsMobileSearchOpen(false)
                }
              }}
            />
            <button 
              type="submit"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}