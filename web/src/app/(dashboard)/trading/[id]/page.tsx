import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { TradingPlan } from '@/types/database'
import TradingPlanActions from './TradingPlanActions'
import ChartButton from './ChartButton'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ id: string }>
}

// Helper to format price - handles very small numbers
function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return '-'
  if (price === 0) return '$0'

  // For very small prices, use scientific notation or show more decimals
  if (price < 0.00000001) {
    return `$${price.toExponential(4)}`
  }
  if (price < 0.0001) {
    return `$${price.toFixed(12)}`
  }
  if (price < 1) {
    return `$${price.toFixed(8)}`
  }
  return `$${price.toFixed(4)}`
}

// Format token amounts with proper decimals
function formatTokenAmount(rawAmount: number | null | undefined, decimals: number = 9): string {
  if (rawAmount === null || rawAmount === undefined) return '-'

  // Convert from smallest units to human-readable
  const amount = rawAmount / Math.pow(10, decimals)

  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(2)}B`
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M`
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(2)}K`
  }
  if (amount >= 1) {
    return amount.toFixed(2)
  }
  return amount.toFixed(6)
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

  // Calculate estimated value based on entry
  const entryValueUsd = typedPlan.amount_sol * (typedPlan.entry_price_usd ? (typedPlan.entry_price_usd * (typedPlan.amount_tokens || 1)) : 0)

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/"
          className="text-zinc-400 hover:text-white transition-colors"
        >
          &larr; Back
        </Link>
        <h1 className="text-2xl font-bold text-white">
          {typedPlan.token_symbol && typedPlan.token_symbol !== 'Unknown'
            ? typedPlan.token_symbol
            : typedPlan.token_mint.slice(0, 8) + '...'} Trade
        </h1>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-6">
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Status</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            typedPlan.status === 'active'
              ? 'bg-green-500/20 text-green-400'
              : typedPlan.status === 'pending'
              ? 'bg-yellow-500/20 text-yellow-400'
              : typedPlan.status === 'waiting_entry'
              ? 'bg-purple-500/20 text-purple-400'
              : typedPlan.status === 'completed'
              ? 'bg-blue-500/20 text-blue-400'
              : typedPlan.status === 'expired'
              ? 'bg-orange-500/20 text-orange-400'
              : 'bg-zinc-500/20 text-zinc-400'
          }`}>
            {typedPlan.status === 'waiting_entry' ? 'Limit Order' : typedPlan.status}
          </span>
        </div>

        {/* Token Info */}
        <div className="p-4 bg-zinc-800 rounded-lg">
          <p className="text-sm text-zinc-400">Token</p>
          <p className="text-white font-medium">
            {typedPlan.token_symbol || typedPlan.token_mint.slice(0, 8)} {typedPlan.token_name && `(${typedPlan.token_name})`}
          </p>
          <p className="text-xs text-zinc-500 font-mono mt-1 break-all">
            {typedPlan.token_mint}
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <ChartButton
              tokenMint={typedPlan.token_mint}
              tokenSymbol={typedPlan.token_symbol || typedPlan.token_mint.slice(0, 8)}
            />
            <a
              href={`https://solscan.io/token/${typedPlan.token_mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Solscan
            </a>
            <a
              href={`https://dexscreener.com/solana/${typedPlan.token_mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              DexScreener
            </a>
            <a
              href={`https://birdeye.so/token/${typedPlan.token_mint}?chain=solana`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Birdeye
            </a>
          </div>
        </div>

        {/* Limit Order Details */}
        {typedPlan.status === 'waiting_entry' && (
          <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg space-y-2">
            <h3 className="text-sm font-medium text-purple-400">Limit Order Details</h3>
            <div className="flex justify-between">
              <span className="text-zinc-400">Target Entry Price</span>
              <span className="text-purple-400">{formatPrice(typedPlan.target_entry_price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Price Threshold</span>
              <span className="text-white">±{typedPlan.entry_threshold_percent}%</span>
            </div>
            {typedPlan.waiting_since && (
              <>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Waiting Since</span>
                  <span className="text-white">
                    {new Date(typedPlan.waiting_since).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Time Remaining</span>
                  <span className="text-white">
                    {Math.max(0, Math.round(
                      ((typedPlan.max_wait_hours || 24) * 60 * 60 * 1000 -
                        (Date.now() - new Date(typedPlan.waiting_since).getTime())) / (1000 * 60 * 60)
                    ))}h of {typedPlan.max_wait_hours}h
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Expired Notice */}
        {typedPlan.status === 'expired' && (
          <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <p className="text-orange-400 text-sm">
              This limit order expired after waiting {typedPlan.max_wait_hours} hours without the target price being reached.
            </p>
          </div>
        )}

        {/* Position Details (for active trades) */}
        {typedPlan.status === 'active' && typedPlan.amount_tokens && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-2">
            <h3 className="text-sm font-medium text-green-400">Position</h3>
            <div className="flex justify-between">
              <span className="text-zinc-400">Tokens Held</span>
              <span className="text-white font-mono">{formatTokenAmount(typedPlan.amount_tokens, typedPlan.token_decimals || 9)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Entry Value</span>
              <span className="text-white">{typedPlan.amount_sol} SOL</span>
            </div>
          </div>
        )}

        {/* Trade Parameters */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-400">Trade Parameters</h3>
          <div className="flex justify-between">
            <span className="text-zinc-400">Investment</span>
            <span className="text-white">{typedPlan.amount_sol} SOL</span>
          </div>
          {typedPlan.entry_price_usd && (
            <div className="flex justify-between">
              <span className="text-zinc-400">Entry Price</span>
              <span className="text-white">{formatPrice(typedPlan.entry_price_usd)}</span>
            </div>
          )}
          {typedPlan.target_entry_price && typedPlan.status !== 'waiting_entry' && (
            <div className="flex justify-between">
              <span className="text-zinc-400">Target Entry</span>
              <span className="text-zinc-400">{formatPrice(typedPlan.target_entry_price)}</span>
            </div>
          )}
        </div>

        {/* Exit Triggers */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-400">Exit Triggers</h3>
          <div className="flex justify-between items-center">
            <div>
              <span className="text-zinc-400">Stop Loss</span>
              <span className="text-zinc-500 text-sm ml-2">(-{typedPlan.stop_loss_percent}%)</span>
            </div>
            <span className="text-red-400">{formatPrice(typedPlan.stop_loss_price)}</span>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <span className="text-zinc-400">Take Profit</span>
              <span className="text-zinc-500 text-sm ml-2">(+{typedPlan.take_profit_percent}%)</span>
            </div>
            <span className="text-green-400">{formatPrice(typedPlan.take_profit_price)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-zinc-800">
            <span className="text-zinc-400">Risk/Reward</span>
            <span className="text-white">
              1:{(typedPlan.take_profit_percent / typedPlan.stop_loss_percent).toFixed(1)}
            </span>
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
            {typedPlan.triggered_at && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Triggered At</span>
                <span className="text-white">
                  {new Date(typedPlan.triggered_at).toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-zinc-400">Exit Price</span>
              <span className="text-white">{formatPrice(typedPlan.exit_price_usd)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-zinc-700">
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

        {/* Timestamps */}
        <div className="text-xs text-zinc-500 space-y-1 pt-4 border-t border-zinc-800">
          <p>Created: {new Date(typedPlan.created_at).toLocaleString()}</p>
          <p>Updated: {new Date(typedPlan.updated_at).toLocaleString()}</p>
        </div>

        {/* Actions */}
        <TradingPlanActions plan={typedPlan} />
      </div>
    </div>
  )
}
