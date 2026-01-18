'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingToken, TrendingCategory, TrendingInterval } from '@/lib/jupiter'
import { PriceAnalysis } from '@/lib/birdeye'

interface AnalysisResult {
  token: TrendingToken
  analysis?: Partial<PriceAnalysis>
  error?: string
}

interface TrendingResponse {
  trending: TrendingToken[]
  analyses?: AnalysisResult[]
  category: string
  interval: string
  count: number
  warning?: string
  fetchedAt?: string | null
  cached?: boolean
}

export default function TrendingPage() {
  const [category, setCategory] = useState<TrendingCategory>('toptrending')
  const [interval, setInterval] = useState<TrendingInterval>('1h')
  const [data, setData] = useState<TrendingResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Helper to build trade URL with token info
  const getTradeUrl = (token: TrendingToken) => {
    const params = new URLSearchParams({
      token: token.id,
      symbol: token.symbol,
      name: token.name,
    })
    return `/trading/new?${params.toString()}`
  }

  // Load cached data on mount
  useEffect(() => {
    const loadCached = async () => {
      try {
        const params = new URLSearchParams({
          category,
          interval,
          limit: '20',
          cached: 'true',
        })

        const res = await fetch(`/api/tokens/trending?${params}`)
        const result = await res.json()

        if (res.ok && result.trending && result.trending.length > 0) {
          setData(result)
        }
      } catch (err) {
        console.error('Failed to load cached data:', err)
      }
      setInitialLoading(false)
    }

    loadCached()
  }, []) // Only on mount

  const fetchTrending = async (analyze: boolean = false) => {
    setLoading(true)
    if (analyze) setAnalyzing(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        category,
        interval,
        limit: '20',
        ...(analyze ? { analyze: 'true' } : {}),
      })

      const res = await fetch(`/api/tokens/trending?${params}`)
      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Failed to fetch trending')
      }

      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch')
    }

    setLoading(false)
    setAnalyzing(false)
  }

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`
    if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`
    return `$${num.toFixed(2)}`
  }

  const formatPrice = (price: number) => {
    if (price < 0.00001) return price.toExponential(2)
    if (price < 0.01) return price.toFixed(6)
    if (price < 1) return price.toFixed(4)
    return price.toFixed(2)
  }

  const getSignalColor = (signal?: string) => {
    switch (signal) {
      case 'strong_buy': return 'text-green-400 bg-green-500/20'
      case 'buy': return 'text-green-300 bg-green-500/10'
      case 'wait': return 'text-yellow-400 bg-yellow-500/10'
      case 'avoid': return 'text-red-400 bg-red-500/10'
      default: return 'text-zinc-400 bg-zinc-800'
    }
  }

  const getVerdictColor = (verdict?: string) => {
    switch (verdict) {
      case 'good': return 'text-green-400'
      case 'moderate': return 'text-yellow-400'
      case 'poor': return 'text-red-400'
      default: return 'text-zinc-400'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`

    return date.toLocaleString()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Trending Tokens</h1>
        <button
          onClick={() => router.push('/trading/new')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Manual Trade
        </button>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TrendingCategory)}
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="toptrending">Top Trending</option>
              <option value="toptraded">Top Traded</option>
              <option value="toporganicscore">Top Organic</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Interval</label>
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value as TrendingInterval)}
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="5m">5 minutes</option>
              <option value="1h">1 hour</option>
              <option value="6h">6 hours</option>
              <option value="24h">24 hours</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchTrending(false)}
              disabled={loading}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 text-white rounded-lg transition-colors"
            >
              {loading && !analyzing ? 'Loading...' : 'Fetch Fresh'}
            </button>
            <button
              onClick={() => fetchTrending(true)}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg transition-colors"
            >
              {analyzing ? 'Analyzing...' : 'Fetch & Analyze'}
            </button>
          </div>
        </div>

        {/* Timestamp indicator */}
        {data?.fetchedAt && (
          <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center gap-2 text-sm">
            <span className={data.cached ? 'text-yellow-400' : 'text-green-400'}>
              {data.cached ? '●' : '●'}
            </span>
            <span className="text-zinc-400">
              {data.cached ? 'Cached data' : 'Fresh data'} from {formatTimestamp(data.fetchedAt)}
            </span>
            {data.cached && (
              <span className="text-zinc-500">
                — Click "Fetch Fresh" to update
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {data?.warning && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
          <p className="text-yellow-400">{data.warning}</p>
        </div>
      )}

      {/* Analysis Results */}
      {data?.analyses && data.analyses.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Scalping Opportunities</h2>
          <div className="grid gap-4">
            {data.analyses
              .filter(a => a.analysis && !a.error)
              .map((result, i) => (
                <div
                  key={result.token.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors cursor-pointer"
                  onClick={() => router.push(getTradeUrl(result.token))}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-sm font-medium text-zinc-400">
                        {i + 1}
                      </div>
                      {result.token.icon && (
                        <img
                          src={result.token.icon}
                          alt={result.token.symbol}
                          className="w-10 h-10 rounded-full"
                        />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{result.token.symbol}</span>
                          {result.token.isVerified && (
                            <span className="text-xs text-blue-400">✓</span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-400">{result.token.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-medium">${formatPrice(result.token.usdPrice)}</p>
                      <p className={`text-sm ${(result.token.stats1h?.priceChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(result.token.stats1h?.priceChange || 0) >= 0 ? '+' : ''}
                        {(result.token.stats1h?.priceChange || 0).toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  {result.analysis && (
                    <div className="mt-4 pt-4 border-t border-zinc-800">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {/* Entry Signal */}
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">Entry Signal</p>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getSignalColor(result.analysis.entrySignal)}`}>
                            {(result.analysis.entrySignal || 'unknown').replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        {/* Scalping Score */}
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">Scalp Score</p>
                          <p className={`font-medium ${getVerdictColor(result.analysis.scalpingVerdict)}`}>
                            {result.analysis.scalpingScore ?? '-'}/100
                          </p>
                        </div>
                        {/* Optimal Entry */}
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">Optimal Entry</p>
                          <p className="text-white">${formatPrice(result.analysis.optimalEntryPrice ?? 0)}</p>
                          <p className={`text-xs ${(result.analysis.currentVsOptimalPercent ?? 0) <= 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {(result.analysis.currentVsOptimalPercent ?? 0) > 0 ? '+' : ''}
                            {(result.analysis.currentVsOptimalPercent ?? 0).toFixed(1)}% from optimal
                          </p>
                        </div>
                        {/* Expected Profit */}
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">Expected Profit</p>
                          <p className="text-green-400 font-medium">
                            +{(result.analysis.expectedProfitAtCurrent ?? 0).toFixed(1)}%
                          </p>
                        </div>
                        {/* Trend */}
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">Trend</p>
                          <p className={`font-medium ${
                            result.analysis.trend === 'bullish' ? 'text-green-400' :
                            result.analysis.trend === 'bearish' ? 'text-red-400' : 'text-zinc-400'
                          }`}>
                            {(result.analysis.trend || 'unknown').charAt(0).toUpperCase() + (result.analysis.trend || 'unknown').slice(1)}
                          </p>
                        </div>
                      </div>
                      {result.analysis.entrySignalReason && (
                        <p className="text-xs text-zinc-500 mt-3">{result.analysis.entrySignalReason}</p>
                      )}
                    </div>
                  )}

                  {result.error && (
                    <p className="text-xs text-red-400 mt-2">{result.error}</p>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Trending List */}
      {data?.trending && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">
            All Trending ({data.count})
          </h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-800">
                <tr className="text-left text-xs text-zinc-400">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Token</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Change</th>
                  <th className="px-4 py-3 text-right">Volume</th>
                  <th className="px-4 py-3 text-right">Liquidity</th>
                  <th className="px-4 py-3 text-center">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {data.trending.map((token, i) => (
                  <tr
                    key={token.id}
                    className="hover:bg-zinc-800/50 cursor-pointer transition-colors"
                    onClick={() => router.push(getTradeUrl(token))}
                  >
                    <td className="px-4 py-3 text-zinc-400">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {token.icon && (
                          <img src={token.icon} alt={token.symbol} className="w-6 h-6 rounded-full" />
                        )}
                        <div>
                          <span className="text-white">{token.symbol}</span>
                          {token.isVerified && <span className="text-blue-400 ml-1 text-xs">✓</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-white">
                      ${formatPrice(token.usdPrice)}
                    </td>
                    <td className={`px-4 py-3 text-right ${(token.stats1h?.priceChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {(token.stats1h?.priceChange || 0) >= 0 ? '+' : ''}
                      {(token.stats1h?.priceChange || 0).toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400">
                      {formatNumber(token.stats1h?.volume || 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400">
                      {formatNumber(token.liquidity)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        {token.isSus && (
                          <span className="text-xs text-red-400" title="Suspicious">⚠️</span>
                        )}
                        {token.mintAuthority && (
                          <span className="text-xs text-yellow-400" title="Mint Authority">🔓</span>
                        )}
                        {token.freezeAuthority && (
                          <span className="text-xs text-yellow-400" title="Freeze Authority">❄️</span>
                        )}
                        {!token.isSus && !token.mintAuthority && !token.freezeAuthority && (
                          <span className="text-green-400">✓</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!data && !loading && !initialLoading && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-zinc-400">No cached data available</p>
          <p className="text-zinc-500 text-sm mt-2">
            Click "Fetch Fresh" to load trending tokens, or "Fetch & Analyze" to also run scalping analysis
          </p>
        </div>
      )}

      {initialLoading && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-zinc-700 border-t-blue-500"></div>
          <p className="text-zinc-400 mt-4">Loading cached data...</p>
        </div>
      )}
    </div>
  )
}
