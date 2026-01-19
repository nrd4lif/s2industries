import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

interface RouteContext {
  params: Promise<{ mint: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireAuth()
    const { mint } = await context.params
    const supabase = await createClient()

    // Get timeframe from query params (default to 24h)
    const url = new URL(request.url)
    const timeframe = url.searchParams.get('timeframe') || '24h'

    // Calculate the start time based on timeframe
    let startTime: Date
    const now = new Date()

    switch (timeframe) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case '6h':
        startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000)
        break
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'all':
        startTime = new Date(0) // Beginning of time
        break
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }

    // Fetch price snapshots for this token
    const { data: snapshots, error } = await supabase
      .from('price_snapshots')
      .select('price_usd, created_at')
      .eq('token_mint', mint)
      .gte('created_at', startTime.toISOString())
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch price snapshots:', error)
      return NextResponse.json(
        { error: 'Failed to fetch chart data' },
        { status: 500 }
      )
    }

    // Get related trading plan info for this token (entry/exit points)
    const { data: tradingPlans } = await supabase
      .from('trading_plans')
      .select('entry_price_usd, exit_price_usd, stop_loss_price, take_profit_price, status, triggered_by, created_at, triggered_at')
      .eq('token_mint', mint)
      .in('status', ['active', 'completed', 'cancelled'])
      .order('created_at', { ascending: false })
      .limit(5)

    // Format data for chart
    const chartData = (snapshots || []).map(s => ({
      time: s.created_at,
      price: s.price_usd,
    }))

    // Get markers for entry/exit points
    const markers = (tradingPlans || []).flatMap(plan => {
      const result = []

      if (plan.entry_price_usd && plan.created_at) {
        result.push({
          type: 'entry',
          time: plan.created_at,
          price: plan.entry_price_usd,
        })
      }

      if (plan.exit_price_usd && plan.triggered_at) {
        result.push({
          type: plan.triggered_by === 'take_profit' ? 'take_profit' : 'stop_loss',
          time: plan.triggered_at,
          price: plan.exit_price_usd,
        })
      }

      return result
    })

    // Get current SL/TP levels from active plans
    const activePlan = tradingPlans?.find(p => p.status === 'active')
    const levels = activePlan ? {
      stopLoss: activePlan.stop_loss_price,
      takeProfit: activePlan.take_profit_price,
      entry: activePlan.entry_price_usd,
    } : null

    return NextResponse.json({
      data: chartData,
      markers,
      levels,
      dataPoints: chartData.length,
      timeframe,
    })
  } catch (err) {
    console.error('Chart data error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch chart data' },
      { status: 400 }
    )
  }
}
