'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HomeIcon, BookOpenIcon, ProgressIcon, ArrowLeftIcon } from './components/Icons'

const navItems = [
  { href: '/pds', label: 'Home', Icon: HomeIcon },
  { href: '/pds/modules', label: 'Modules', Icon: BookOpenIcon },
  { href: '/pds/progress', label: 'Progress', Icon: ProgressIcon },
]

export default function PDSLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-zinc-800 bg-zinc-950">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo */}
          <div className="flex items-center h-16 px-4 border-b border-zinc-800">
            <Link href="/pds" className="flex items-center gap-2">
              <span className="text-xl font-bold text-white">PDS</span>
              <span className="text-xs text-zinc-500">Product Data Science</span>
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-2 py-4 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/pds' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600/10 text-blue-400'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  <item.Icon size={18} />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Back to main site */}
          <div className="p-4 border-t border-zinc-800">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors"
            >
              <ArrowLeftIcon size={16} />
              Back to S2
            </Link>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 md:pl-64">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-40 bg-zinc-950 border-b border-zinc-800">
          <div className="flex items-center justify-between px-4 h-14">
            <Link href="/pds" className="text-lg font-bold text-white">
              PDS
            </Link>
            <Link href="/" className="flex items-center gap-1 text-sm text-zinc-500">
              <ArrowLeftIcon size={14} />
              S2
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 pb-20 md:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 z-50">
          <div className="flex items-center justify-around h-16">
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/pds' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                    isActive ? 'text-blue-400' : 'text-zinc-500'
                  }`}
                >
                  <item.Icon size={20} />
                  <span className="text-xs mt-1">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
