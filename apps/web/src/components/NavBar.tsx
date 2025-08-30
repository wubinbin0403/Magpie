import { useState } from 'react'
import { Link } from 'react-router-dom'

interface NavBarProps {
  onSearch: (query: string) => void
}

export default function NavBar({ onSearch }: NavBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(searchQuery)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    // Real-time search with debounce could be implemented here
  }

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
              <li><Link to="/" className="hover:bg-base-200 text-base-content">首页</Link></li>
              <li><Link to="/search" className="hover:bg-base-200 text-base-content">搜索</Link></li>
              <li><Link to="/admin" className="hover:bg-base-200 text-base-content">管理</Link></li>
            </ul>
          </div>

          {/* Logo */}
          <Link to="/" className="btn btn-ghost text-xl font-bold hover:bg-white/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2L3 7v11h4v-6h6v6h4V7l-7-5z"/>
                </svg>
              </div>
              <span className="text-white">Magpie</span>
            </div>
          </Link>

          {/* Desktop navigation */}
          <div className="hidden lg:flex">
            <ul className="menu menu-horizontal px-1 gap-2">
              <li>
                <Link 
                  to="/" 
                  className="hover:bg-white/10 text-white/90 hover:text-white transition-colors"
                >
                  首页
                </Link>
              </li>
              <li>
                <Link 
                  to="/search" 
                  className="hover:bg-white/10 text-white/90 hover:text-white transition-colors"
                >
                  搜索
                </Link>
              </li>
              <li>
                <Link 
                  to="/admin" 
                  className="hover:bg-white/10 text-white/90 hover:text-white transition-colors"
                >
                  管理
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Right side - Search and theme toggle */}
        <div className="flex items-center gap-2">
          {/* Search form */}
          <form onSubmit={handleSearch} className="relative">
            <div className="form-control">
              <input
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
            {!isSearchFocused && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-white/50 pointer-events-none">
                ⌘K
              </div>
            )}
          </form>

          {/* Theme toggle */}
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            </div>
            <ul className="dropdown-content z-[1] menu p-2 shadow bg-white rounded-box w-32 border border-base-300">
              <li><a className="text-sm hover:bg-base-200 text-base-content">浅色</a></li>
              <li><a className="text-sm hover:bg-base-200 text-base-content">深色</a></li>
              <li><a className="text-sm hover:bg-base-200 text-base-content">自动</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}