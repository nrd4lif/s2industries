'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface TokenInfo {
  mint: string
  symbol: string
  name: string
  decimals: number
  logoURI?: string
}

interface QuoteInfo {
  priceUsd: number
  outAmount: string
  slippageBps: number
  priceImpact: number
}

export default function NewTradePage() {
  const [tokenMint, setTokenMint] = useState('')
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [quote, setQuote] = useState<QuoteInfo | null>(null)
  const [amountSol, setAmountSol] = useState('0.1')
  const [stopLoss, setStopLoss] = useState('5')
  const [takeProfit, setTakeProfit] = useState('10')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSearch = async () => {
    if (!tokenMint) return

    setLoading(true)
    setError(null)
    setTokenInfo(null)
    setQuote(null)

    try {
      // Search for token
      const searchRes = await fetch(`/api/tokens/search?query=${encodeURIComponent(tokenMint)}`)
      const searchData = await searchRes.json()

      if (searchData.tokens && searchData.tokens.length > 0) {
        const token = searchData.tokens[0]
        setTokenInfo(token)

        // Get quote
        const quoteRes = await fetch(`/api/tokens/quote?mint=${token.mint}&amount=${amountSol}`)
        const quoteData = await quoteRes.json()

        if (quoteData.quote) {
          setQuote(quoteData.quote)
        }
      } else {
        setError('Token not found')
      }
    } catch {
      setError('Failed to search token')
    }

    setLoading(false)
  }

  const handleCreatePlan = async () => {
    if (!tokenInfo || !quote) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/trading/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_mint: tokenInfo.mint,
          amount_sol: parseFloat(amountSol),
          stop_loss_percent: parseFloat(stopLoss),
          take_profit_percent: parseFloat(takeProfit),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create plan')
      }

      const data = await res.json()
      router.push(`/trading/${data.plan.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create plan')
    }

    setLoading(false)
  }

  const stopLossPrice = quote ? quote.priceUsd * (1 - parseFloat(stopLoss) / 100) : 0
  const takeProfitPrice = quote ? quote.priceUsd * (1 + parseFloat(takeProfit) / 100) : 0

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-white mb-6">New Trade</h1>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-6">
        {/* Token Search */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">
            Token (mint address or symbol)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={tokenMint}
              onChange={(e) => setTokenMint(e.target.value)}
              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="BONK, WIF, or mint address..."
            />
            <button
              onClick={handleSearch}
              disabled={loading || !tokenMint}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 text-white rounded-lg transition-colors"
            >
              {loading ? '...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Token Info */}
        {tokenInfo && (
          <div className="p-4 bg-zinc-800 rounded-lg">
            <div className="flex items-center gap-3">
              {tokenInfo.logoURI && (
                <img
                  src={tokenInfo.logoURI}
                  alt={tokenInfo.symbol}
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div>
                <p className="text-white font-medium">{tokenInfo.symbol}</p>
                <p className="text-sm text-zinc-400">{tokenInfo.name}</p>
              </div>
            </div>
            {quote && (
              <div className="mt-3 pt-3 border-t border-zinc-700">
                <p className="text-sm text-zinc-400">
                  Current Price: <span className="text-white">${quote.priceUsd.toFixed(8)}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Trade Parameters */}
        {tokenInfo && quote && (
          <>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Amount (SOL)
              </label>
              <input
                type="number"
                value={amountSol}
                onChange={(e) => setAmountSol(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0.01"
                step="0.01"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Stop Loss (%)
                </label>
                <input
                  type="number"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="50"
                />
                <p className="text-xs text-red-400 mt-1">
                  Sell if price drops to ${stopLossPrice.toFixed(8)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Take Profit (%)
                </label>
                <input
                  type="number"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="500"
                />
                <p className="text-xs text-green-400 mt-1">
                  Sell if price rises to ${takeProfitPrice.toFixed(8)}
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 bg-zinc-800 rounded-lg space-y-2">
              <h3 className="text-sm font-medium text-zinc-400">Trade Summary</h3>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Entry</span>
                <span className="text-white">{amountSol} SOL @ ${quote.priceUsd.toFixed(8)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Stop Loss</span>
                <span className="text-red-400">-{stopLoss}% (${stopLossPrice.toFixed(8)})</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Take Profit</span>
                <span className="text-green-400">+{takeProfit}% (${takeProfitPrice.toFixed(8)})</span>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <button
              onClick={handleCreatePlan}
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Creating...' : 'Create Trading Plan'}
            </button>
          </>
        )}

        {error && !tokenInfo && (
          <p className="text-red-500 text-sm">{error}</p>
        )}
      </div>
    </div>
  )
}
