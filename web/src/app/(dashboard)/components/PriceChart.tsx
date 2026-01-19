'use client'

import { useState, useEffect, useCallback } from 'react'

interface ChartDataPoint {
  time: string
  price: number
}

interface ChartMarker {
  type: 'entry' | 'take_profit' | 'stop_loss'
  time: string
  price: number
}

interface ChartLevels {
  stopLoss: number | null
  takeProfit: number | null
  entry: number | null
}

interface PriceChartProps {
  tokenMint: string
  tokenSymbol: string
  isOpen: boolean
  onClose: () => void
}

type Timeframe = '1h' | '6h' | '24h' | '7d' | 'all'

export default function PriceChart({ tokenMint, tokenSymbol, isOpen, onClose }: PriceChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('24h')
  const [data, setData] = useState<ChartDataPoint[]>([])
  const [markers, setMarkers] = useState<ChartMarker[]>([])
  const [levels, setLevels] = useState<ChartLevels | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchChartData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/tokens/${tokenMint}/chart?timeframe=${timeframe}`)
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch chart data')
      }

      setData(json.data || [])
      setMarkers(json.markers || [])
      setLevels(json.levels)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chart')
    }

    setLoading(false)
  }, [tokenMint, timeframe])

  useEffect(() => {
    if (isOpen) {
      fetchChartData()
    }
  }, [isOpen, fetchChartData])

  if (!isOpen) return null

  const formatPrice = (price: number) => {
    if (price < 0.00000001) return price.toExponential(4)
    if (price < 0.0001) return price.toFixed(10)
    if (price < 1) return price.toFixed(6)
    return price.toFixed(4)
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    if (timeframe === '1h' || timeframe === '6h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    if (timeframe === '24h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // Calculate chart dimensions
  const chartHeight = 300
  const chartWidth = 600
  const padding = { top: 20, right: 80, bottom: 30, left: 20 }

  // Calculate price range
  const prices = data.map(d => d.price)
  const allPrices = [
    ...prices,
    ...(levels?.stopLoss ? [levels.stopLoss] : []),
    ...(levels?.takeProfit ? [levels.takeProfit] : []),
    ...(levels?.entry ? [levels.entry] : []),
  ]
  const minPrice = Math.min(...allPrices) * 0.99
  const maxPrice = Math.max(...allPrices) * 1.01
  const priceRange = maxPrice - minPrice || 1

  // Scale functions
  const scaleX = (index: number) => padding.left + (index / (data.length - 1 || 1)) * (chartWidth - padding.left - padding.right)
  const scaleY = (price: number) => chartHeight - padding.bottom - ((price - minPrice) / priceRange) * (chartHeight - padding.top - padding.bottom)

  // Generate path
  const linePath = data.length > 1
    ? data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(d.price)}`).join(' ')
    : ''

  // Price change
  const priceChange = data.length > 1
    ? ((data[data.length - 1].price - data[0].price) / data[0].price) * 100
    : 0

  const timeframes: { value: Timeframe; label: string }[] = [
    { value: '1h', label: '1H' },
    { value: '6h', label: '6H' },
    { value: '24h', label: '24H' },
    { value: '7d', label: '7D' },
    { value: 'all', label: 'All' },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[700px] md:max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-lg z-50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-white">{tokenSymbol} Price Chart</h2>
            <p className="text-xs text-zinc-500 font-mono">{tokenMint.slice(0, 12)}...{tokenMint.slice(-8)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-2 p-4 border-b border-zinc-800">
          {timeframes.map(tf => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                timeframe === tf.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {tf.label}
            </button>
          ))}
          <div className="flex-1" />
          {data.length > 0 && (
            <div className="text-right">
              <p className="text-white font-medium">${formatPrice(data[data.length - 1]?.price || 0)}</p>
              <p className={`text-sm ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </p>
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="flex-1 p-4 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-zinc-400">Loading chart data...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-red-400">{error}</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-zinc-400">No price data available for this timeframe</p>
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto max-h-[400px]"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                const price = minPrice + priceRange * pct
                const y = scaleY(price)
                return (
                  <g key={pct}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={chartWidth - padding.right}
                      y2={y}
                      stroke="#27272a"
                      strokeWidth={1}
                    />
                    <text
                      x={chartWidth - padding.right + 5}
                      y={y + 4}
                      fill="#71717a"
                      fontSize={10}
                    >
                      ${formatPrice(price)}
                    </text>
                  </g>
                )
              })}

              {/* Stop Loss level */}
              {levels?.stopLoss && (
                <g>
                  <line
                    x1={padding.left}
                    y1={scaleY(levels.stopLoss)}
                    x2={chartWidth - padding.right}
                    y2={scaleY(levels.stopLoss)}
                    stroke="#ef4444"
                    strokeWidth={1}
                    strokeDasharray="4,4"
                  />
                  <text
                    x={padding.left + 5}
                    y={scaleY(levels.stopLoss) - 5}
                    fill="#ef4444"
                    fontSize={10}
                  >
                    SL: ${formatPrice(levels.stopLoss)}
                  </text>
                </g>
              )}

              {/* Take Profit level */}
              {levels?.takeProfit && (
                <g>
                  <line
                    x1={padding.left}
                    y1={scaleY(levels.takeProfit)}
                    x2={chartWidth - padding.right}
                    y2={scaleY(levels.takeProfit)}
                    stroke="#22c55e"
                    strokeWidth={1}
                    strokeDasharray="4,4"
                  />
                  <text
                    x={padding.left + 5}
                    y={scaleY(levels.takeProfit) - 5}
                    fill="#22c55e"
                    fontSize={10}
                  >
                    TP: ${formatPrice(levels.takeProfit)}
                  </text>
                </g>
              )}

              {/* Entry level */}
              {levels?.entry && (
                <g>
                  <line
                    x1={padding.left}
                    y1={scaleY(levels.entry)}
                    x2={chartWidth - padding.right}
                    y2={scaleY(levels.entry)}
                    stroke="#3b82f6"
                    strokeWidth={1}
                    strokeDasharray="2,2"
                  />
                  <text
                    x={padding.left + 5}
                    y={scaleY(levels.entry) + 12}
                    fill="#3b82f6"
                    fontSize={10}
                  >
                    Entry: ${formatPrice(levels.entry)}
                  </text>
                </g>
              )}

              {/* Price line */}
              <path
                d={linePath}
                fill="none"
                stroke={priceChange >= 0 ? '#22c55e' : '#ef4444'}
                strokeWidth={2}
              />

              {/* Markers */}
              {markers.map((marker, i) => {
                // Find closest data point for x position
                const markerTime = new Date(marker.time).getTime()
                let closestIdx = 0
                let closestDiff = Infinity
                data.forEach((d, idx) => {
                  const diff = Math.abs(new Date(d.time).getTime() - markerTime)
                  if (diff < closestDiff) {
                    closestDiff = diff
                    closestIdx = idx
                  }
                })

                const x = scaleX(closestIdx)
                const y = scaleY(marker.price)
                const color = marker.type === 'entry' ? '#3b82f6' : marker.type === 'take_profit' ? '#22c55e' : '#ef4444'

                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r={5} fill={color} />
                    <circle cx={x} cy={y} r={8} fill="none" stroke={color} strokeWidth={1} opacity={0.5} />
                  </g>
                )
              })}

              {/* Time labels */}
              {data.length > 0 && (
                <>
                  <text
                    x={padding.left}
                    y={chartHeight - 10}
                    fill="#71717a"
                    fontSize={10}
                  >
                    {formatTime(data[0].time)}
                  </text>
                  <text
                    x={chartWidth - padding.right}
                    y={chartHeight - 10}
                    fill="#71717a"
                    fontSize={10}
                    textAnchor="end"
                  >
                    {formatTime(data[data.length - 1].time)}
                  </text>
                </>
              )}
            </svg>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 text-center">
          <p className="text-xs text-zinc-500">
            {data.length} data points | Data collected from trading bot monitoring
          </p>
        </div>
      </div>
    </>
  )
}
