'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TradingPlan } from '@/types/database'
import PriceChart from './PriceChart'

interface RecentTradesListProps {
  trades: TradingPlan[]
}

export default function RecentTradesList({ trades }: RecentTradesListProps) {
  const [chartOpen, setChartOpen] = useState<{ mint: string; symbol: string } | null>(null)

  if (!trades || trades.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center">
        <p className="text-zinc-400">No completed trades yet</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {trades.map((trade: TradingPlan) => (
          <div
            key={trade.id}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center justify-between">
              <Link href={`/trading/${trade.id}`} className="flex-1">
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
              </Link>

              {/* Chart button */}
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setChartOpen({
                    mint: trade.token_mint,
                    symbol: trade.token_symbol || trade.token_mint.slice(0, 8),
                  })
                }}
                className="p-2 text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 rounded transition-colors mr-3"
                title="View price chart"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4v16" />
                </svg>
              </button>

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
          </div>
        ))}
      </div>

      {/* Chart Modal */}
      {chartOpen && (
        <PriceChart
          tokenMint={chartOpen.mint}
          tokenSymbol={chartOpen.symbol}
          isOpen={true}
          onClose={() => setChartOpen(null)}
        />
      )}
    </>
  )
}
