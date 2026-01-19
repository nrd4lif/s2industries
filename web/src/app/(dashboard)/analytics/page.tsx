import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { TradingPlan } from '@/types/database'

interface TradeStats {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  totalPnlSol: number
  totalPnlPercent: number
  avgWinSol: number
  avgLossSol: number
  avgWinPercent: number
  avgLossPercent: number
  bestTradeSol: number
  worstTradeSol: number
  bestTradePercent: number
  worstTradePercent: number
  profitFactor: number
  avgHoldTime: string
  totalVolumeSol: number
}

interface TokenPerformance {
  symbol: string
  trades: number
  wins: number
  losses: number
  pnlSol: number
  pnlPercent: number
}

interface DailyPnl {
  date: string
  pnl: number
  trades: number
  cumulative: number
}

function calculateStats(trades: TradingPlan[]): TradeStats {
  const completedTrades = trades.filter(t => t.status === 'completed' && t.profit_loss_sol !== null)

  if (completedTrades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnlSol: 0,
      totalPnlPercent: 0,
      avgWinSol: 0,
      avgLossSol: 0,
      avgWinPercent: 0,
      avgLossPercent: 0,
      bestTradeSol: 0,
      worstTradeSol: 0,
      bestTradePercent: 0,
      worstTradePercent: 0,
      profitFactor: 0,
      avgHoldTime: '-',
      totalVolumeSol: 0,
    }
  }

  const wins = completedTrades.filter(t => (t.profit_loss_sol || 0) > 0)
  const losses = completedTrades.filter(t => (t.profit_loss_sol || 0) <= 0)

  const totalPnlSol = completedTrades.reduce((sum, t) => sum + (t.profit_loss_sol || 0), 0)
  const totalVolumeSol = completedTrades.reduce((sum, t) => sum + t.amount_sol, 0)

  const avgWinSol = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.profit_loss_sol || 0), 0) / wins.length : 0
  const avgLossSol = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + (t.profit_loss_sol || 0), 0) / losses.length) : 0

  const avgWinPercent = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.profit_loss_percent || 0), 0) / wins.length : 0
  const avgLossPercent = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + (t.profit_loss_percent || 0), 0) / losses.length) : 0

  const pnlValues = completedTrades.map(t => t.profit_loss_sol || 0)
  const pnlPercentValues = completedTrades.map(t => t.profit_loss_percent || 0)

  const totalGains = wins.reduce((sum, t) => sum + (t.profit_loss_sol || 0), 0)
  const totalLosses = Math.abs(losses.reduce((sum, t) => sum + (t.profit_loss_sol || 0), 0))
  const profitFactor = totalLosses > 0 ? totalGains / totalLosses : totalGains > 0 ? Infinity : 0

  // Calculate average hold time
  let totalHoldMs = 0
  let holdCount = 0
  for (const trade of completedTrades) {
    if (trade.triggered_at && trade.created_at) {
      totalHoldMs += new Date(trade.triggered_at).getTime() - new Date(trade.created_at).getTime()
      holdCount++
    }
  }
  const avgHoldMs = holdCount > 0 ? totalHoldMs / holdCount : 0
  const avgHoldHours = avgHoldMs / (1000 * 60 * 60)
  const avgHoldTime = avgHoldHours < 1
    ? `${Math.round(avgHoldMs / (1000 * 60))}m`
    : avgHoldHours < 24
    ? `${avgHoldHours.toFixed(1)}h`
    : `${(avgHoldHours / 24).toFixed(1)}d`

  return {
    totalTrades: completedTrades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: (wins.length / completedTrades.length) * 100,
    totalPnlSol,
    totalPnlPercent: completedTrades.reduce((sum, t) => sum + (t.profit_loss_percent || 0), 0),
    avgWinSol,
    avgLossSol,
    avgWinPercent,
    avgLossPercent,
    bestTradeSol: Math.max(...pnlValues),
    worstTradeSol: Math.min(...pnlValues),
    bestTradePercent: Math.max(...pnlPercentValues),
    worstTradePercent: Math.min(...pnlPercentValues),
    profitFactor,
    avgHoldTime,
    totalVolumeSol,
  }
}

function getTokenPerformance(trades: TradingPlan[]): TokenPerformance[] {
  const completedTrades = trades.filter(t => t.status === 'completed' && t.profit_loss_sol !== null)
  const tokenMap = new Map<string, TokenPerformance>()

  for (const trade of completedTrades) {
    const symbol = trade.token_symbol || trade.token_mint.slice(0, 8)
    const existing = tokenMap.get(symbol) || { symbol, trades: 0, wins: 0, losses: 0, pnlSol: 0, pnlPercent: 0 }

    existing.trades++
    existing.pnlSol += trade.profit_loss_sol || 0
    existing.pnlPercent += trade.profit_loss_percent || 0
    if ((trade.profit_loss_sol || 0) > 0) {
      existing.wins++
    } else {
      existing.losses++
    }

    tokenMap.set(symbol, existing)
  }

  return Array.from(tokenMap.values()).sort((a, b) => b.pnlSol - a.pnlSol)
}

function getDailyPnl(trades: TradingPlan[]): DailyPnl[] {
  const completedTrades = trades.filter(t => t.status === 'completed' && t.triggered_at)
  const dailyMap = new Map<string, { pnl: number; trades: number }>()

  for (const trade of completedTrades) {
    const date = new Date(trade.triggered_at!).toISOString().split('T')[0]
    const existing = dailyMap.get(date) || { pnl: 0, trades: 0 }
    existing.pnl += trade.profit_loss_sol || 0
    existing.trades++
    dailyMap.set(date, existing)
  }

  const sortedDates = Array.from(dailyMap.keys()).sort()
  let cumulative = 0

  return sortedDates.map(date => {
    const data = dailyMap.get(date)!
    cumulative += data.pnl
    return { date, pnl: data.pnl, trades: data.trades, cumulative }
  })
}

export default async function AnalyticsPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  // Get all trading plans
  const { data: trades } = await supabase
    .from('trading_plans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const allTrades = (trades || []) as TradingPlan[]
  const stats = calculateStats(allTrades)
  const tokenPerformance = getTokenPerformance(allTrades)
  const dailyPnl = getDailyPnl(allTrades)

  // Get trade counts by status
  const statusCounts = {
    active: allTrades.filter(t => t.status === 'active').length,
    pending: allTrades.filter(t => t.status === 'pending' || t.status === 'waiting_entry').length,
    completed: allTrades.filter(t => t.status === 'completed').length,
    cancelled: allTrades.filter(t => t.status === 'cancelled').length,
    expired: allTrades.filter(t => t.status === 'expired').length,
  }

  // Get trigger type breakdown
  const triggerCounts = {
    takeProfit: allTrades.filter(t => t.triggered_by === 'take_profit').length,
    stopLoss: allTrades.filter(t => t.triggered_by === 'stop_loss').length,
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Analytics</h1>

      {stats.totalTrades === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-zinc-400">No completed trades yet. Start trading to see your analytics!</p>
        </div>
      ) : (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-sm text-zinc-400">Total P&L</p>
              <p className={`text-2xl font-bold ${stats.totalPnlSol >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.totalPnlSol >= 0 ? '+' : ''}{stats.totalPnlSol.toFixed(4)} SOL
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-sm text-zinc-400">Win Rate</p>
              <p className={`text-2xl font-bold ${stats.winRate >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                {stats.winRate.toFixed(1)}%
              </p>
              <p className="text-xs text-zinc-500">{stats.winningTrades}W / {stats.losingTrades}L</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-sm text-zinc-400">Profit Factor</p>
              <p className={`text-2xl font-bold ${stats.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-sm text-zinc-400">Total Trades</p>
              <p className="text-2xl font-bold text-white">{stats.totalTrades}</p>
              <p className="text-xs text-zinc-500">Vol: {stats.totalVolumeSol.toFixed(2)} SOL</p>
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Win/Loss Breakdown */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Performance Breakdown</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Avg Win</span>
                  <span className="text-green-400">+{stats.avgWinSol.toFixed(4)} SOL ({stats.avgWinPercent.toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Avg Loss</span>
                  <span className="text-red-400">-{stats.avgLossSol.toFixed(4)} SOL ({stats.avgLossPercent.toFixed(1)}%)</span>
                </div>
                <div className="border-t border-zinc-800 pt-3 flex justify-between">
                  <span className="text-zinc-400">Best Trade</span>
                  <span className="text-green-400">+{stats.bestTradeSol.toFixed(4)} SOL ({stats.bestTradePercent.toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Worst Trade</span>
                  <span className="text-red-400">{stats.worstTradeSol.toFixed(4)} SOL ({stats.worstTradePercent.toFixed(1)}%)</span>
                </div>
                <div className="border-t border-zinc-800 pt-3 flex justify-between">
                  <span className="text-zinc-400">Avg Hold Time</span>
                  <span className="text-white">{stats.avgHoldTime}</span>
                </div>
              </div>
            </div>

            {/* Exit Analysis */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Exit Analysis</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-zinc-400">Take Profit</span>
                    <span className="text-green-400">{triggerCounts.takeProfit}</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${stats.totalTrades > 0 ? (triggerCounts.takeProfit / stats.totalTrades) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-zinc-400">Stop Loss</span>
                    <span className="text-red-400">{triggerCounts.stopLoss}</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${stats.totalTrades > 0 ? (triggerCounts.stopLoss / stats.totalTrades) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div className="border-t border-zinc-800 pt-4">
                  <p className="text-sm text-zinc-400 mb-2">Trade Status</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Active: {statusCounts.active}</span>
                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">Pending: {statusCounts.pending}</span>
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">Completed: {statusCounts.completed}</span>
                    <span className="px-2 py-1 bg-zinc-500/20 text-zinc-400 text-xs rounded">Cancelled: {statusCounts.cancelled}</span>
                    <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded">Expired: {statusCounts.expired}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Daily P&L Chart (text-based) */}
          {dailyPnl.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Daily P&L</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-400 text-left">
                      <th className="pb-2">Date</th>
                      <th className="pb-2 text-right">Trades</th>
                      <th className="pb-2 text-right">Daily P&L</th>
                      <th className="pb-2 text-right">Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyPnl.slice(-14).map(day => (
                      <tr key={day.date} className="border-t border-zinc-800">
                        <td className="py-2 text-zinc-300">{day.date}</td>
                        <td className="py-2 text-right text-zinc-400">{day.trades}</td>
                        <td className={`py-2 text-right ${day.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {day.pnl >= 0 ? '+' : ''}{day.pnl.toFixed(4)}
                        </td>
                        <td className={`py-2 text-right ${day.cumulative >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {day.cumulative >= 0 ? '+' : ''}{day.cumulative.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Token Performance */}
          {tokenPerformance.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Token Performance</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-400 text-left">
                      <th className="pb-2">Token</th>
                      <th className="pb-2 text-right">Trades</th>
                      <th className="pb-2 text-right">W/L</th>
                      <th className="pb-2 text-right">Win Rate</th>
                      <th className="pb-2 text-right">P&L (SOL)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokenPerformance.map(token => (
                      <tr key={token.symbol} className="border-t border-zinc-800">
                        <td className="py-2 text-white font-medium">{token.symbol}</td>
                        <td className="py-2 text-right text-zinc-400">{token.trades}</td>
                        <td className="py-2 text-right">
                          <span className="text-green-400">{token.wins}</span>
                          <span className="text-zinc-500">/</span>
                          <span className="text-red-400">{token.losses}</span>
                        </td>
                        <td className="py-2 text-right text-zinc-300">
                          {((token.wins / token.trades) * 100).toFixed(0)}%
                        </td>
                        <td className={`py-2 text-right ${token.pnlSol >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {token.pnlSol >= 0 ? '+' : ''}{token.pnlSol.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
