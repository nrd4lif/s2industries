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

  // Get active trading plans
  const { data: activePlans } = await supabase
    .from('trading_plans')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['active', 'draft'])
    .order('created_at', { ascending: false })

  // Get recent completed trades
  const { data: recentTrades } = await supabase
    .from('trading_plans')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'completed')
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
            {activePlans.map((plan: TradingPlan) => (
              <Link
                key={plan.id}
                href={`/trading/${plan.id}`}
                className="block bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">
                      {plan.token_symbol || plan.token_mint.slice(0, 8)}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {plan.amount_sol} SOL @ ${plan.entry_price_usd?.toFixed(6)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-1 rounded ${
                      plan.status === 'active'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {plan.status}
                    </span>
                    <p className="text-sm text-zinc-400 mt-1">
                      SL: -{plan.stop_loss_percent}% / TP: +{plan.take_profit_percent}%
                    </p>
                  </div>
                </div>
              </Link>
            ))}
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
              <div
                key={trade.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">
                      {trade.token_symbol || trade.token_mint.slice(0, 8)}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {trade.triggered_by === 'take_profit' ? 'Take Profit' : 'Stop Loss'}
                    </p>
                  </div>
                  <div className="text-right">
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
