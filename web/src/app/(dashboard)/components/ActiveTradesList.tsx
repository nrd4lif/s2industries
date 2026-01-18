'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { TradingPlan } from '@/types/database'

interface ActiveTradesListProps {
  initialPlans: TradingPlan[]
}

interface PriceData {
  [tokenMint: string]: {
    price: number
    loading: boolean
  }
}

export default function ActiveTradesList({ initialPlans }: ActiveTradesListProps) {
  const [plans] = useState(initialPlans)
  const [prices, setPrices] = useState<PriceData>({})
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchPrices = useCallback(async () => {
    // Get unique token mints from waiting_entry plans
    const waitingPlans = plans.filter(p => p.status === 'waiting_entry')
    const activePlans = plans.filter(p => p.status === 'active')
    const allPlansNeedingPrice = [...waitingPlans, ...activePlans]

    if (allPlansNeedingPrice.length === 0) return

    const mints = [...new Set(allPlansNeedingPrice.map(p => p.token_mint))]

    // Set loading state
    const loadingState: PriceData = {}
    mints.forEach(mint => {
      loadingState[mint] = { price: prices[mint]?.price || 0, loading: true }
    })
    setPrices(prev => ({ ...prev, ...loadingState }))

    // Fetch prices (using Jupiter Price API via our proxy or directly)
    try {
      const res = await fetch(`/api/tokens/prices?mints=${mints.join(',')}`)
      if (res.ok) {
        const data = await res.json()
        const newPrices: PriceData = {}
        mints.forEach(mint => {
          newPrices[mint] = {
            price: data.prices?.[mint] || 0,
            loading: false,
          }
        })
        setPrices(prev => ({ ...prev, ...newPrices }))
        setLastUpdated(new Date())
      }
    } catch (err) {
      console.error('Failed to fetch prices:', err)
      // Clear loading state on error
      const errorState: PriceData = {}
      mints.forEach(mint => {
        errorState[mint] = { price: prices[mint]?.price || 0, loading: false }
      })
      setPrices(prev => ({ ...prev, ...errorState }))
    }
  }, [plans, prices])

  useEffect(() => {
    fetchPrices()
    // Refresh every 90 seconds
    const interval = setInterval(fetchPrices, 90000)
    return () => clearInterval(interval)
  }, []) // Only run on mount, not on every prices change

  if (!plans || plans.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center">
        <p className="text-zinc-400">No active trades</p>
      </div>
    )
  }

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

  const formatPrice = (price: number) => {
    if (price < 0.00000001) return price.toExponential(4)
    if (price < 0.0001) return price.toFixed(10)
    if (price < 1) return price.toFixed(6)
    return price.toFixed(4)
  }

  return (
    <div className="space-y-3">
      {lastUpdated && (
        <p className="text-xs text-zinc-500 text-right">
          Prices updated: {lastUpdated.toLocaleTimeString()}
          <button
            onClick={fetchPrices}
            className="ml-2 text-blue-400 hover:text-blue-300"
          >
            Refresh
          </button>
        </p>
      )}
      {plans.map((plan: TradingPlan) => {
        const isLimitOrder = plan.status === 'waiting_entry'
        const isActive = plan.status === 'active'
        const currentPrice = prices[plan.token_mint]?.price
        const priceLoading = prices[plan.token_mint]?.loading

        // Calculate distance to target for limit orders
        let distanceToTarget: number | null = null
        let distancePercent: number | null = null
        if (isLimitOrder && plan.target_entry_price && currentPrice) {
          distanceToTarget = currentPrice - plan.target_entry_price
          distancePercent = (distanceToTarget / plan.target_entry_price) * 100
        }

        // Calculate P&L for active trades
        let unrealizedPnl: number | null = null
        let unrealizedPnlPercent: number | null = null
        if (isActive && plan.entry_price_usd && currentPrice) {
          unrealizedPnlPercent = ((currentPrice - plan.entry_price_usd) / plan.entry_price_usd) * 100
          unrealizedPnl = plan.amount_sol * (unrealizedPnlPercent / 100)
        }

        return (
          <Link
            key={plan.id}
            href={`/trading/${plan.id}`}
            className="block bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium">
                    {plan.token_symbol && plan.token_symbol !== 'Unknown'
                      ? plan.token_symbol
                      : plan.token_mint.slice(0, 8) + '...'}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded ${statusColors[plan.status] || 'bg-zinc-500/20 text-zinc-400'}`}>
                    {statusLabels[plan.status] || plan.status}
                  </span>
                </div>
                <p className="text-sm text-zinc-400">
                  {plan.amount_sol} SOL
                </p>
              </div>

              {/* Price info for limit orders */}
              {isLimitOrder && (
                <div className="text-right flex-1">
                  <div className="flex items-center justify-end gap-4">
                    <div>
                      <p className="text-xs text-zinc-500">Current</p>
                      <p className="text-white">
                        {priceLoading ? (
                          <span className="text-zinc-500">...</span>
                        ) : currentPrice ? (
                          `$${formatPrice(currentPrice)}`
                        ) : (
                          <span className="text-zinc-500">--</span>
                        )}
                      </p>
                    </div>
                    <div className="text-zinc-500">→</div>
                    <div>
                      <p className="text-xs text-zinc-500">Target</p>
                      <p className="text-purple-400">
                        ${formatPrice(plan.target_entry_price || 0)}
                      </p>
                    </div>
                    {distancePercent !== null && (
                      <div>
                        <p className="text-xs text-zinc-500">Distance</p>
                        <p className={distancePercent <= (plan.entry_threshold_percent || 1) ? 'text-green-400' : 'text-yellow-400'}>
                          {distancePercent > 0 ? '+' : ''}{distancePercent.toFixed(2)}%
                        </p>
                      </div>
                    )}
                  </div>
                  {plan.waiting_since && (
                    <p className="text-xs text-zinc-500 mt-1">
                      Waiting {Math.round((Date.now() - new Date(plan.waiting_since).getTime()) / (1000 * 60 * 60))}h / {plan.max_wait_hours}h max
                    </p>
                  )}
                </div>
              )}

              {/* Price info for active trades */}
              {isActive && (
                <div className="text-right flex-1">
                  <div className="flex items-center justify-end gap-4">
                    <div>
                      <p className="text-xs text-zinc-500">Entry</p>
                      <p className="text-white">
                        ${formatPrice(plan.entry_price_usd || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Current</p>
                      <p className="text-white">
                        {priceLoading ? (
                          <span className="text-zinc-500">...</span>
                        ) : currentPrice ? (
                          `$${formatPrice(currentPrice)}`
                        ) : (
                          <span className="text-zinc-500">--</span>
                        )}
                      </p>
                    </div>
                    {unrealizedPnlPercent !== null && (
                      <div>
                        <p className="text-xs text-zinc-500">P&L</p>
                        <p className={unrealizedPnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {unrealizedPnlPercent >= 0 ? '+' : ''}{unrealizedPnlPercent.toFixed(2)}%
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    SL: ${formatPrice(plan.stop_loss_price || 0)} / TP: ${formatPrice(plan.take_profit_price || 0)}
                  </p>
                </div>
              )}

              {/* Pending orders just show basic info */}
              {plan.status === 'pending' && (
                <div className="text-right">
                  <p className="text-sm text-zinc-400">
                    SL: -{plan.stop_loss_percent}% / TP: +{plan.take_profit_percent}%
                  </p>
                </div>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
