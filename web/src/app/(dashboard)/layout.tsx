import { requireAuth } from '@/lib/auth'
import Link from 'next/link'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold text-white">
              S2
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/trading/trending" className="text-sm text-zinc-400 hover:text-white transition-colors">
                Trending
              </Link>
              <Link href="/trading/new" className="text-sm text-zinc-400 hover:text-white transition-colors">
                New Trade
              </Link>
              <Link href="/settings/wallet" className="text-sm text-zinc-400 hover:text-white transition-colors">
                Wallet
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">{user.email}</span>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
