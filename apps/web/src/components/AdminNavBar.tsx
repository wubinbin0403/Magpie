import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface AdminNavBarProps {
  onToggleSidebar?: () => void
  user?: {
    role: string
    name?: string
  }
}

export default function AdminNavBar({ onToggleSidebar, user }: AdminNavBarProps) {
  const { logout } = useAuth()
  
  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="navbar shadow-lg fixed top-0 left-0 right-0 z-40 bg-magpie-200 text-white">
      <div className="w-full flex items-center justify-between px-4 lg:px-6">
        {/* Left side - Logo and mobile menu */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <button
            onClick={onToggleSidebar}
            className="lg:hidden btn btn-ghost btn-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo */}
          <Link to="/admin" className="btn btn-ghost hover:bg-white/10 group">
            <div className="flex items-center gap-2">
              <img 
                src="/magpie-icon.png" 
                alt="Magpie" 
                className="h-10 max-w-10 object-contain transition-transform duration-500 group-hover:[transform:rotateY(180deg)]"
                style={{ transformStyle: 'preserve-3d' }}
              />
              <div className="flex items-center gap-2">
                <span className="text-white text-xl font-bold">Magpie</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
                  管理
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* Right side - User menu */}
        <div className="flex items-center gap-2">
          {/* Quick actions */}
          <div className="hidden md:flex items-center gap-2">
            <Link 
              to="/admin/pending"
              className="btn btn-ghost btn-sm hover:bg-white/10"
              title="待处理链接"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </Link>
            
            <Link 
              to="/admin/add"
              className="btn btn-ghost btn-sm hover:bg-white/10"
              title="添加新链接"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </Link>
          </div>

          {/* User dropdown */}
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-sm hover:bg-white/10">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-xs font-bold">
                    {user?.name?.[0] || 'A'}
                  </span>
                </div>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <ul className="dropdown-content z-[1] menu p-2 shadow-lg bg-white rounded-lg w-48 border border-slate-200 mt-2">
              <li>
                <Link to="/admin/profile" className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  个人设置
                </Link>
              </li>
              <li>
                <Link to="/admin/system" className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  系统设置
                </Link>
              </li>
              <div className="divider my-1"></div>
              <li>
                <Link to="/" className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  返回网站
                </Link>
              </li>
              <li>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md w-full text-left"
                >
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  退出登录
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}