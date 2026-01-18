import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import Link from 'next/link'
import { TradingPlan } from '@/types/database'

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
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-400">Trading Wallet</p>
              <p className="text-white font-mono text-sm">
                {wallet.public_key.slice(0, 8)}...{wallet.public_key.slice(-8)}
              </p>
            </div>
            <Link
              href="/settings/wallet"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Manage
            </Link>
          </div>
        </div>
      )}

      {/* Active Trades */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Active Trades</h2>
        {!activePlans || activePlans.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center">
            <p className="text-zinc-400">No active trades</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activePlans.map((plan: TradingPlan) => {
              const isLimitOrder = plan.status === 'waiting_entry' || plan.target_entry_price !== null
              const statusColors: Record<string, string> = {
                active: 'bg-green-500/20 text-green-400',
                pending: 'bg-yellow-500/20 text-yellow-400',
                waiting_entry: 'bg-purple-500/20 text-purple-400',
              }
              const statusLabels: Record<string, string> = {
                active: 'Active',
                pending: 'Pending',
                waiting_entry: 'Limit Order',
              }
              return (
                <Link
                  key={plan.id}
                  href={`/trading/${plan.id}`}
                  className="block bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">
                        {plan.token_symbol && plan.token_symbol !== 'Unknown'
                          ? plan.token_symbol
                          : plan.token_mint.slice(0, 8) + '...'}
                      </p>
                      {isLimitOrder ? (
                        <p className="text-sm text-zinc-400">
                          {plan.amount_sol} SOL @ target ${plan.target_entry_price?.toFixed(8)}
                        </p>
                      ) : (
                        <p className="text-sm text-zinc-400">
                          {plan.amount_sol} SOL @ ${plan.entry_price_usd?.toFixed(6)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded ${statusColors[plan.status] || 'bg-zinc-500/20 text-zinc-400'}`}>
                        {statusLabels[plan.status] || plan.status}
                      </span>
                      {isLimitOrder && plan.waiting_since && (
                        <p className="text-xs text-zinc-500 mt-1">
                          Waiting {Math.round((Date.now() - new Date(plan.waiting_since).getTime()) / (1000 * 60 * 60))}h / {plan.max_wait_hours}h max
                        </p>
                      )}
                      <p className="text-sm text-zinc-400 mt-1">
                        SL: -{plan.stop_loss_percent}% / TP: +{plan.take_profit_percent}%
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
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
                    {trade.status === 'completed' ? (
                      <>
                        <p className={`font-medium ${
                          (trade.profit_loss_percent || 0) >= 0
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}>
                          {(trade.profit_loss_percent || 0) >= 0 ? '+' : ''}
                          {trade.profit_loss_percent?.toFixed(2)}%
                        </p>
                        <p className="text-sm text-zinc-400">
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
