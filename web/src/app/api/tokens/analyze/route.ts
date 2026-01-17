import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/auth'
import { BirdeyeClient } from '@/lib/birdeye'
import { JupiterClient } from '@/lib/jupiter'

// Use service role for logging (bypasses RLS)
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: Request) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')

    if (!address) {
      return NextResponse.json(
        { error: 'Token address required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.BIRDEYE_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Birdeye API key not configured' },
        { status: 500 }
      )
    }

    const birdeye = new BirdeyeClient(apiKey)
    const analysis = await birdeye.analyzeToken(address)

    // Get token info from Jupiter for symbol/name
    let tokenSymbol: string | null = null
    let tokenName: string | null = null
    try {
      const jupiter = new JupiterClient(process.env.JUPITER_API_KEY || '')
      const tokens = await jupiter.searchToken(address)
      if (tokens.length > 0) {
        tokenSymbol = tokens[0].symbol
        tokenName = tokens[0].name
      }
    } catch {
      // Continue without token info
    }

    // Log to database for ML training
    const supabase = createServiceClient()

    // Log OHLCV candles
    if (analysis.candles.length > 0) {
      const candleRows = analysis.candles.map(candle => ({
        token_mint: address,
        interval: '15m',
        open_price: candle.o,
        high_price: candle.h,
        low_price: candle.l,
        close_price: candle.c,
        volume: candle.v,
        candle_time: new Date(candle.unixTime * 1000).toISOString(),
        source: 'birdeye',
      }))

      // Upsert to avoid duplicates
      const { error: candleError } = await supabase
        .from('ohlcv_candles')
        .upsert(candleRows, {
          onConflict: 'token_mint,interval,candle_time',
          ignoreDuplicates: true,
        })

      if (candleError) {
        console.error('Failed to log candles:', candleError)
      }
    }

    // Log analysis result
    const { error: analysisError } = await supabase
      .from('token_analyses')
      .insert({
        token_mint: address,
        token_symbol: tokenSymbol,
        token_name: tokenName,
        current_price: analysis.currentPrice,
        high_24h: analysis.high24h,
        low_24h: analysis.low24h,
        price_change_24h: analysis.priceChange24h,
        price_change_percent_24h: analysis.priceChangePercent24h,
        volatility: analysis.volatility,
        trend: analysis.trend,
        trend_strength: analysis.trendStrength,
        avg_volume: analysis.avgVolume,
        support_level: analysis.support,
        resistance_level: analysis.resistance,
        suggested_stop_loss_percent: analysis.suggestedStopLossPercent,
        suggested_take_profit_percent: analysis.suggestedTakeProfitPercent,
        // New entry analysis fields
        optimal_entry_price: analysis.optimalEntryPrice,
        optimal_entry_reason: analysis.optimalEntryReason,
        current_vs_optimal_percent: analysis.currentVsOptimalPercent,
        entry_signal: analysis.entrySignal,
        entry_signal_reason: analysis.entrySignalReason,
        expected_profit_at_current: analysis.expectedProfitAtCurrent,
        expected_profit_at_optimal: analysis.expectedProfitAtOptimal,
        scalping_score: analysis.scalpingScore,
        scalping_verdict: analysis.scalpingVerdict,
        scalping_reason: analysis.scalpingReason,
        candles_analyzed: analysis.candles.length,
      })

    if (analysisError) {
      console.error('Failed to log analysis:', analysisError)
    }

    return NextResponse.json({ analysis })
  } catch (err) {
    console.error('Token analysis error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to analyze token' },
      { status: 500 }
    )
  }
}
