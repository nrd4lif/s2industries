import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import Link from 'next/link'
import { TradingPlan } from '@/types/database'
import WalletStats from './components/WalletStats'
import ActiveTradesList from './components/ActiveTradesList'
import RecentTradesList from './components/RecentTradesList'

export default async function DashboardPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  // Check if wallet is configured
  const { data: wallet } = await supabase
    .from('wallet_config')
    .select('public_key, label')
    .eq('user_id', user.id)
    .single()

  // Get active trading plans (including pending and waiting_entry)
  const { data: activePlans } = await supabase
    .from('trading_plans')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['active', 'pending', 'waiting_entry'])
    .order('created_at', { ascending: false })

  // Get recent completed/expired trades
  const { data: recentTrades } = await supabase
    .from('trading_plans')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['completed', 'expired', 'cancelled'])
    .order('updated_at', { ascending: false })
    .limit(5)

  // Calculate SOL allocation
  const pendingSol = (activePlans || [])
    .filter((p: TradingPlan) => p.status === 'pending' || p.status === 'waiting_entry')
    .reduce((sum: number, p: TradingPlan) => sum + p.amount_sol, 0)

  const activeSol = (activePlans || [])
    .filter((p: TradingPlan) => p.status === 'active')
    .reduce((sum: number, p: TradingPlan) => sum + p.amount_sol, 0)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Trading Dashboard</h1>
        {wallet && (
          <Link
            href="/trading/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            New Trade
          </Link>
        )}
      </div>

      {/* Wallet Status */}
      {!wallet ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-2">Setup Required</h2>
          <p className="text-zinc-400 mb-4">
            You need to configure a trading wallet before you can start trading.
          </p>
          <Link
            href="/settings/wallet"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Setup Wallet
          </Link>
        </div>
      ) : (
        <WalletStats
          publicKey={wallet.public_key}
          pendingSol={pendingSol}
          activeSol={activeSol}
        />
      )}

      {/* Active Trades */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Active Trades</h2>
        <ActiveTradesList initialPlans={activePlans || []} />
      </div>

      {/* Recent Trades */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Recent Trades</h2>
        <RecentTradesList trades={recentTrades || []} />
      </div>
    </div>
  )
}
