import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import Link from 'next/link'
import { TradingPlan } from '@/types/database'
import WalletStats from './components/WalletStats'
import ActiveTradesList from './components/ActiveTradesList'

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
        {!recentTrades || recentTrades.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center">
            <p className="text-zinc-400">No completed trades yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentTrades.map((trade: TradingPlan) => (
              <Link
                key={trade.id}
                href={`/trading/${trade.id}`}
                className="block bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">
                      {trade.token_symbol && trade.token_symbol !== 'Unknown'
                        ? trade.token_symbol
                        : trade.token_mint.slice(0, 8) + '...'}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {trade.status === 'expired'
                        ? 'Limit Order Expired'
                        : trade.status === 'cancelled'
                        ? 'Cancelled'
                        : trade.triggered_by === 'take_profit'
                        ? 'Take Profit'
                        : 'Stop Loss'}
                    </p>
                  </div>
                  <div className="text-right">
                    {trade.profit_loss_percent !== null && trade.profit_loss_percent !== undefined ? (
                      <>
                        <p className={`font-medium ${
                          trade.profit_loss_percent >= 0
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}>
                          {trade.profit_loss_percent >= 0 ? '+' : ''}
                          {trade.profit_loss_percent.toFixed(2)}%
                        </p>
                        <p className="text-sm text-zinc-400">
                          {(trade.profit_loss_sol || 0) >= 0 ? '+' : ''}
                          {trade.profit_loss_sol?.toFixed(4)} SOL
                        </p>
                      </>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded ${
                        trade.status === 'expired'
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-zinc-500/20 text-zinc-400'
                      }`}>
                        {trade.status}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
