import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { TradingPlan } from '@/types/database'
import TradingPlanActions from './TradingPlanActions'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TradingPlanPage({ params }: PageProps) {
  const { id } = await params
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: plan } = await supabase
    .from('trading_plans')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!plan) {
    notFound()
  }

  const typedPlan = plan as TradingPlan

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-white mb-6">
        {typedPlan.token_symbol || typedPlan.token_mint.slice(0, 8)} Trade
      </h1>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-6">
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Status</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            typedPlan.status === 'active'
              ? 'bg-green-500/20 text-green-400'
              : typedPlan.status === 'draft'
              ? 'bg-yellow-500/20 text-yellow-400'
              : typedPlan.status === 'completed'
              ? 'bg-blue-500/20 text-blue-400'
              : 'bg-zinc-500/20 text-zinc-400'
          }`}>
            {typedPlan.status}
          </span>
        </div>

        {/* Token Info */}
        <div className="p-4 bg-zinc-800 rounded-lg">
          <p className="text-sm text-zinc-400">Token</p>
          <p className="text-white font-medium">
            {typedPlan.token_symbol} {typedPlan.token_name && `(${typedPlan.token_name})`}
          </p>
          <p className="text-xs text-zinc-500 font-mono mt-1 break-all">
            {typedPlan.token_mint}
          </p>
        </div>

        {/* Trade Details */}
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-zinc-400">Amount</span>
            <span className="text-white">{typedPlan.amount_sol} SOL</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Entry Price</span>
            <span className="text-white">${typedPlan.entry_price_usd?.toFixed(8)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Stop Loss ({typedPlan.stop_loss_percent}%)</span>
            <span className="text-red-400">${typedPlan.stop_loss_price?.toFixed(8)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Take Profit ({typedPlan.take_profit_percent}%)</span>
            <span className="text-green-400">${typedPlan.take_profit_price?.toFixed(8)}</span>
          </div>
        </div>

        {/* Results (if completed) */}
        {typedPlan.status === 'completed' && (
          <div className="p-4 bg-zinc-800 rounded-lg space-y-2">
            <h3 className="text-sm font-medium text-zinc-400">Results</h3>
            <div className="flex justify-between">
              <span className="text-zinc-400">Triggered By</span>
              <span className={typedPlan.triggered_by === 'take_profit' ? 'text-green-400' : 'text-red-400'}>
                {typedPlan.triggered_by === 'take_profit' ? 'Take Profit' : 'Stop Loss'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Exit Price</span>
              <span className="text-white">${typedPlan.exit_price_usd?.toFixed(8)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">P&L</span>
              <span className={`font-medium ${
                (typedPlan.profit_loss_percent || 0) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {(typedPlan.profit_loss_percent || 0) >= 0 ? '+' : ''}
                {typedPlan.profit_loss_percent?.toFixed(2)}% ({typedPlan.profit_loss_sol?.toFixed(4)} SOL)
              </span>
            </div>
          </div>
        )}

        {/* Transactions */}
        {(typedPlan.entry_tx_signature || typedPlan.exit_tx_signature) && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-400">Transactions</h3>
            {typedPlan.entry_tx_signature && (
              <a
                href={`https://solscan.io/tx/${typedPlan.entry_tx_signature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-blue-400 hover:text-blue-300 truncate"
              >
                Entry: {typedPlan.entry_tx_signature.slice(0, 20)}...
              </a>
            )}
            {typedPlan.exit_tx_signature && (
              <a
                href={`https://solscan.io/tx/${typedPlan.exit_tx_signature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-blue-400 hover:text-blue-300 truncate"
              >
                Exit: {typedPlan.exit_tx_signature.slice(0, 20)}...
              </a>
            )}
          </div>
        )}

        {/* Actions */}
        <TradingPlanActions plan={typedPlan} />
      </div>
    </div>
  )
}
