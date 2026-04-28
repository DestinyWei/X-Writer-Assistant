import { Outlet, NavLink } from 'react-router-dom'
import { Newspaper, PenSquare, CalendarDays, BookCheck } from 'lucide-react'
import clsx from 'clsx'

const NAV = [
  { to: '/feeds', icon: Newspaper, label: '选题池' },
  { to: '/workshop', icon: PenSquare, label: '草稿工坊' },
  { to: '/calendar', icon: CalendarDays, label: '排期日历' },
  { to: '/published', icon: BookCheck, label: '发布记录' },
]

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider">AllScale</div>
          <div className="text-base font-bold text-gray-900 mt-0.5">推文助手</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-100 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                )
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-gray-100">
          <div className="text-xs text-gray-400">Phase 1a · 本地版</div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  )
}
