'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PriceAnalysis } from '@/lib/birdeye'

interface TokenInfo {
  mint: string
  symbol: string
  name: string
  decimals: number
  logoURI?: string
}

export default function NewTradePage() {
  const searchParams = useSearchParams()
  const [tokenMint, setTokenMint] = useState('')
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [analysis, setAnalysis] = useState<PriceAnalysis | null>(null)
  const [amountSol, setAmountSol] = useState('0.1')
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [useLimitBuy, setUseLimitBuy] = useState(false)
  const [targetEntryPrice, setTargetEntryPrice] = useState('')
  const [entryThreshold, setEntryThreshold] = useState('1.0')
  const [maxWaitHours, setMaxWaitHours] = useState('24')
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  const router = useRouter()

  // Get URL params
  const urlToken = searchParams.get('token') || ''
  const urlSymbol = searchParams.get('symbol') || ''
  const urlName = searchParams.get('name') || ''

  // Initialize from URL params and auto-search
  useEffect(() => {
    if (initialized) return
    if (urlToken) {
      setTokenMint(urlToken)
      setInitialized(true)
      // Trigger search after state is set
      handleSearchWithParams(urlToken, urlSymbol, urlName)
    } else {
      setInitialized(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlToken, urlSymbol, urlName, initialized])

  // Search with explicit params (used when coming from URL)
  const handleSearchWithParams = async (mint: string, symbol: string, name: string) => {
    if (!mint) return

    setLoading(true)
    setError(null)
    setTokenInfo(null)
    setAnalysis(null)

    try {
      // If we have symbol/name from URL params, use them directly
      if (symbol && name) {
        const token: TokenInfo = {
          mint: mint,
          symbol: symbol,
          name: name,
          decimals: 9,
        }
        setTokenInfo(token)

        // Analyze token with Birdeye
        setAnalyzing(true)
        try {
          const analysisRes = await fetch(`/api/tokens/analyze?address=${mint}`)
          const analysisData = await analysisRes.json()

          if (analysisData.analysis) {
            setAnalysis(analysisData.analysis)
            setStopLoss(analysisData.analysis.suggestedStopLossPercent.toFixed(1))
            setTakeProfit(analysisData.analysis.suggestedTakeProfitPercent.toFixed(1))
            setTargetEntryPrice(analysisData.analysis.optimalEntryPrice.toFixed(10))
            if (analysisData.analysis.entrySignal === 'wait') {
              setUseLimitBuy(true)
            }
          }
        } catch (err) {
          console.error('Analysis failed:', err)
        }
        setAnalyzing(false)
        setLoading(false)
        return
      }

      // Fall back to API search
      await doTokenSearch(mint)
    } catch (err) {
      setError('Failed to search token')
    }
    setLoading(false)
  }

  // Manual search (user typed in mint address)
  const handleSearch = async () => {
    if (!tokenMint) return
    setLoading(true)
    setError(null)
    setTokenInfo(null)
    setAnalysis(null)

    try {
      await doTokenSearch(tokenMint)
    } catch (err) {
      setError('Failed to search token')
    }
    setLoading(false)
  }

  // Common token search logic
  const doTokenSearch = async (mint: string) => {
    const searchRes = await fetch(`/api/tokens/search?query=${encodeURIComponent(mint)}`)
    const searchData = await searchRes.json()

    if (searchData.tokens && searchData.tokens.length > 0) {
      const token = searchData.tokens[0]
      setTokenInfo(token)

      // Analyze token with Birdeye
      setAnalyzing(true)
      try {
        const analysisRes = await fetch(`/api/tokens/analyze?address=${token.mint}`)
        const analysisData = await analysisRes.json()

        if (analysisData.analysis) {
          setAnalysis(analysisData.analysis)
          setStopLoss(analysisData.analysis.suggestedStopLossPercent.toFixed(1))
          setTakeProfit(analysisData.analysis.suggestedTakeProfitPercent.toFixed(1))
          setTargetEntryPrice(analysisData.analysis.optimalEntryPrice.toFixed(10))
          if (analysisData.analysis.entrySignal === 'wait') {
            setUseLimitBuy(true)
          }
        }
      } catch (err) {
        console.error('Analysis failed:', err)
      }
      setAnalyzing(false)
    } else {
      setError('Token not found')
    }
  }

  const handleCreatePlan = async () => {
    if (!tokenInfo) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/trading/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_mint: tokenInfo.mint,
          token_symbol: tokenInfo.symbol,
          token_name: tokenInfo.name,
          token_decimals: tokenInfo.decimals,
          amount_sol: parseFloat(amountSol),
          stop_loss_percent: parseFloat(stopLoss),
          take_profit_percent: parseFloat(takeProfit),
          use_limit_buy: useLimitBuy,
          target_entry_price: useLimitBuy ? parseFloat(targetEntryPrice) : undefined,
          entry_threshold_percent: useLimitBuy ? parseFloat(entryThreshold) : undefined,
          max_wait_hours: useLimitBuy ? parseInt(maxWaitHours) : undefined,
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

  const currentPrice = analysis?.currentPrice || 0
  const entryPrice = useLimitBuy && targetEntryPrice ? parseFloat(targetEntryPrice) : currentPrice
  const stopLossPrice = entryPrice * (1 - parseFloat(stopLoss || '0') / 100)
  const takeProfitPrice = entryPrice * (1 + parseFloat(takeProfit || '0') / 100)

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">New Trade</h1>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-6">
        {/* Token Search */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">
            Token (mint address)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={tokenMint}
              onChange={(e) => setTokenMint(e.target.value)}
              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Paste Solana token mint address..."
            />
            <button
              onClick={handleSearch}
              disabled={loading || !tokenMint}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 text-white rounded-lg transition-colors"
            >
              {loading ? '...' : 'Analyze'}
            </button>
          </div>
        </div>

        {/* Loading Analysis */}
        {analyzing && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-zinc-700 border-t-blue-500"></div>
            <p className="text-zinc-400 mt-2">Analyzing 24h price history...</p>
          </div>
        )}

        {/* Token Info + Analysis */}
        {tokenInfo && analysis && !analyzing && (
          <>
            {/* Token Header */}
            <div className="p-4 bg-zinc-800 rounded-lg">
              <div className="flex items-center justify-between">
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
                <div className="text-right">
                  <p className="text-white font-medium">${analysis.currentPrice.toFixed(8)}</p>
                  <p className={`text-sm ${analysis.priceChangePercent24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {analysis.priceChangePercent24h >= 0 ? '+' : ''}{analysis.priceChangePercent24h.toFixed(2)}% (24h)
                  </p>
                </div>
              </div>
            </div>

            {/* Entry Signal */}
            <div className={`p-4 rounded-lg border ${
              analysis.entrySignal === 'strong_buy'
                ? 'bg-green-500/20 border-green-500/40'
                : analysis.entrySignal === 'buy'
                ? 'bg-green-500/10 border-green-500/30'
                : analysis.entrySignal === 'wait'
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-white">Entry Signal</h3>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  analysis.entrySignal === 'strong_buy'
                    ? 'bg-green-500/30 text-green-300'
                    : analysis.entrySignal === 'buy'
                    ? 'bg-green-500/20 text-green-400'
                    : analysis.entrySignal === 'wait'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {analysis.entrySignal.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-zinc-300">{analysis.entrySignalReason}</p>
              <div className="mt-3 grid grid-cols-2 gap-4 pt-3 border-t border-white/10">
                <div>
                  <p className="text-xs text-zinc-500">Optimal Entry</p>
                  <p className="text-white font-medium">${analysis.optimalEntryPrice.toFixed(8)}</p>
                  <p className={`text-xs ${analysis.currentVsOptimalPercent <= 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {analysis.currentVsOptimalPercent > 0 ? '+' : ''}{analysis.currentVsOptimalPercent.toFixed(1)}% from current
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Expected Profit</p>
                  <p className="text-green-400 font-medium">+{analysis.expectedProfitAtCurrent.toFixed(1)}%</p>
                  <p className="text-xs text-zinc-500">
                    ({analysis.expectedProfitAtOptimal.toFixed(1)}% at optimal)
                  </p>
                </div>
              </div>
            </div>

            {/* Scalping Analysis */}
            <div className={`p-4 rounded-lg border ${
              analysis.scalpingVerdict === 'good'
                ? 'bg-green-500/10 border-green-500/30'
                : analysis.scalpingVerdict === 'moderate'
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-white">Scalping Analysis</h3>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  analysis.scalpingVerdict === 'good'
                    ? 'bg-green-500/20 text-green-400'
                    : analysis.scalpingVerdict === 'moderate'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {analysis.scalpingVerdict.toUpperCase()} ({analysis.scalpingScore}/100)
                </span>
              </div>
              <p className="text-sm text-zinc-300">{analysis.scalpingReason}</p>
            </div>

            {/* 24h Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-zinc-800 rounded-lg">
                <p className="text-xs text-zinc-500">24h High</p>
                <p className="text-white font-medium">${analysis.high24h.toFixed(8)}</p>
              </div>
              <div className="p-3 bg-zinc-800 rounded-lg">
                <p className="text-xs text-zinc-500">24h Low</p>
                <p className="text-white font-medium">${analysis.low24h.toFixed(8)}</p>
              </div>
              <div className="p-3 bg-zinc-800 rounded-lg">
                <p className="text-xs text-zinc-500">Volatility</p>
                <p className="text-white font-medium">{analysis.volatility.toFixed(1)}%</p>
              </div>
              <div className="p-3 bg-zinc-800 rounded-lg">
                <p className="text-xs text-zinc-500">Trend</p>
                <p className={`font-medium ${
                  analysis.trend === 'bullish' ? 'text-green-400' :
                  analysis.trend === 'bearish' ? 'text-red-400' : 'text-zinc-400'
                }`}>
                  {analysis.trend.charAt(0).toUpperCase() + analysis.trend.slice(1)}
                </p>
              </div>
            </div>

            {/* Support/Resistance */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-zinc-800 rounded-lg">
                <p className="text-xs text-zinc-500">Support Level</p>
                <p className="text-green-400 font-medium">${analysis.support.toFixed(8)}</p>
              </div>
              <div className="p-3 bg-zinc-800 rounded-lg">
                <p className="text-xs text-zinc-500">Resistance Level</p>
                <p className="text-red-400 font-medium">${analysis.resistance.toFixed(8)}</p>
              </div>
            </div>

            {/* Trade Parameters */}
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

            {/* Limit Buy Option */}
            <div className={`p-4 rounded-lg border ${useLimitBuy ? 'bg-blue-500/10 border-blue-500/30' : 'bg-zinc-800 border-zinc-700'}`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useLimitBuy}
                  onChange={(e) => setUseLimitBuy(e.target.checked)}
                  className="w-5 h-5 rounded bg-zinc-700 border-zinc-600 text-blue-500 focus:ring-blue-500"
                />
                <div>
                  <span className="text-white font-medium">Use Limit Buy</span>
                  <p className="text-xs text-zinc-400">Wait for price to reach target before buying</p>
                </div>
              </label>

              {useLimitBuy && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">
                      Target Entry Price (USD)
                    </label>
                    <input
                      type="number"
                      value={targetEntryPrice}
                      onChange={(e) => setTargetEntryPrice(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      step="0.00000001"
                    />
                    <div className="flex justify-between mt-1">
                      <p className="text-xs text-zinc-500">
                        Current: ${currentPrice.toFixed(8)}
                      </p>
                      <button
                        type="button"
                        onClick={() => setTargetEntryPrice(analysis?.optimalEntryPrice.toFixed(10) || '')}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Use optimal (${analysis?.optimalEntryPrice.toFixed(8)})
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-1">
                        Threshold (%)
                      </label>
                      <input
                        type="number"
                        value={entryThreshold}
                        onChange={(e) => setEntryThreshold(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0.1"
                        max="10"
                        step="0.1"
                      />
                      <p className="text-xs text-zinc-500 mt-1">
                        Buy within ±{entryThreshold}% of target
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-1">
                        Max Wait (hours)
                      </label>
                      <input
                        type="number"
                        value={maxWaitHours}
                        onChange={(e) => setMaxWaitHours(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                        max="168"
                        step="1"
                      />
                      <p className="text-xs text-zinc-500 mt-1">
                        Expires if not filled
                      </p>
                    </div>
                  </div>
                </div>
              )}
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
                  step="0.1"
                />
                <p className="text-xs text-red-400 mt-1">
                  Sell @ ${stopLossPrice.toFixed(8)}
                </p>
                <p className="text-xs text-zinc-500">
                  Suggested: {analysis.suggestedStopLossPercent.toFixed(1)}%
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
                  step="0.1"
                />
                <p className="text-xs text-green-400 mt-1">
                  Sell @ ${takeProfitPrice.toFixed(8)}
                </p>
                <p className="text-xs text-zinc-500">
                  Suggested: {analysis.suggestedTakeProfitPercent.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 bg-zinc-800 rounded-lg space-y-2">
              <h3 className="text-sm font-medium text-zinc-400">Trade Summary</h3>
              {useLimitBuy ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Order Type</span>
                    <span className="text-blue-400">Limit Buy</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Target Entry</span>
                    <span className="text-white">{amountSol} SOL @ ${parseFloat(targetEntryPrice).toFixed(8)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Current Price</span>
                    <span className="text-zinc-400">${analysis.currentPrice.toFixed(8)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Price Difference</span>
                    <span className={analysis.currentPrice > parseFloat(targetEntryPrice) ? 'text-green-400' : 'text-yellow-400'}>
                      {(((parseFloat(targetEntryPrice) - analysis.currentPrice) / analysis.currentPrice) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Expires In</span>
                    <span className="text-zinc-400">{maxWaitHours} hours</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Entry</span>
                  <span className="text-white">{amountSol} SOL @ ${analysis.currentPrice.toFixed(8)} (Market)</span>
                </div>
              )}
              <div className="flex justify-between text-sm pt-2 border-t border-zinc-700">
                <span className="text-zinc-400">Stop Loss</span>
                <span className="text-red-400">-{stopLoss}% (${stopLossPrice.toFixed(8)})</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Take Profit</span>
                <span className="text-green-400">+{takeProfit}% (${takeProfitPrice.toFixed(8)})</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-zinc-700">
                <span className="text-zinc-400">Risk/Reward</span>
                <span className="text-white">
                  1:{(parseFloat(takeProfit) / parseFloat(stopLoss)).toFixed(1)}
                </span>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <button
              onClick={handleCreatePlan}
              disabled={loading || !stopLoss || !takeProfit}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Creating...' : 'Create Trading Plan'}
            </button>
          </>
        )}

        {/* Token found but no analysis */}
        {tokenInfo && !analysis && !analyzing && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-400 text-sm">
              Could not fetch price history for this token. You can still create a manual trade plan.
            </p>
          </div>
        )}

        {error && !tokenInfo && (
          <p className="text-red-500 text-sm">{error}</p>
        )}
      </div>
    </div>
  )
}
