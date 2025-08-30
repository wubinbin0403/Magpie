import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

interface NavBarProps {
  onSearch: (query: string) => void
}

export default function NavBar({ onSearch }: NavBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(searchQuery)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    // Real-time search with debounce could be implemented here
  }

  // Handle Cmd+K / Ctrl+K keyboard shortcut and ESC to blur
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
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
    <div className="navbar text-white shadow-lg fixed top-0 left-0 right-0 z-50" style={{ backgroundColor: '#127176' }}>
      <div className="w-full flex items-center justify-between px-4 lg:px-6">
        {/* Left side - Logo and desktop navigation */}
        <div className="flex items-center gap-8">
          {/* Mobile menu button */}
          <div className="dropdown lg:hidden">
            <div tabIndex={0} role="button" className="btn btn-ghost">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </div>
            <ul className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-white rounded-box w-52 border border-base-300">
              <li><Link to="/search" className="hover:bg-base-200 text-base-content">Archive</Link></li>
            </ul>
          </div>

          {/* Logo */}
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

        </div>

        {/* Right side - Search and archive button */}
        <div className="flex items-center gap-2">
          {/* Search form */}
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
        </div>
      </div>
    </div>
  )
}