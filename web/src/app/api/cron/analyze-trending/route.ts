import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { JupiterClient, TrendingToken } from '@/lib/jupiter'
import { BirdeyeClient, PriceAnalysis } from '@/lib/birdeye'
import { sendTrendingOpportunitiesEmail } from '@/lib/email'

// Use service role for cron job (bypasses RLS)
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface AnalysisResult {
  token: TrendingToken
  analysis?: PriceAnalysis
  error?: string
  skipped?: boolean
  skipReason?: string
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  try {
    const jupiterApiKey = process.env.JUPITER_API_KEY
    const birdeyeApiKey = process.env.BIRDEYE_API_KEY

    if (!jupiterApiKey || !birdeyeApiKey) {
      return NextResponse.json(
        { error: 'Missing API keys (Jupiter or Birdeye)' },
        { status: 500 }
      )
    }

    const jupiter = new JupiterClient(jupiterApiKey)
    const birdeye = new BirdeyeClient(birdeyeApiKey)

    // Fetch top trending tokens (1h interval is good for scalping)
    const trending = await jupiter.getTrendingTokens({
      category: 'toptrending',
      interval: '1h',
      limit: 20,
    })

    // Log trending snapshot
    const snapshotRows = trending.map((token, index) => ({
      token_mint: token.id,
      token_symbol: token.symbol,
      token_name: token.name,
      category: 'toptrending',
      interval: '1h',
      rank_position: index + 1,
      usd_price: token.usdPrice,
      market_cap: token.mcap,
      fdv: token.fdv,
      liquidity: token.liquidity,
      price_change_percent: token.stats1h?.priceChange || 0,
      volume: token.stats1h?.volume || 0,
      buy_volume: token.stats1h?.buyVolume || 0,
      sell_volume: token.stats1h?.sellVolume || 0,
      num_buys: token.stats1h?.numBuys || 0,
      num_sells: token.stats1h?.numSells || 0,
      is_sus: token.isSus,
      mint_authority: token.mintAuthority,
      freeze_authority: token.freezeAuthority,
      top_holder_percentage: token.topHolderPercentage,
      is_verified: token.isVerified,
    }))

    const { error: snapshotError } = await supabase
      .from('trending_snapshots')
      .insert(snapshotRows)

    if (snapshotError) {
      console.error('Failed to log trending snapshots:', snapshotError)
    }

    // Filter tokens with good initial metrics
    const candidateTokens = trending.filter(token => {
      // Skip tokens with security red flags
      if (token.isSus || token.mintAuthority || token.freezeAuthority) {
        return false
      }
      // Require minimum liquidity ($10k)
      if (token.liquidity < 10000) {
        return false
      }
      // Skip if top holder has > 50%
      if (token.topHolderPercentage > 50) {
        return false
      }
      return true
    })

    const analysisResults: AnalysisResult[] = []

    // Analyze top 10 candidates (to stay within rate limits)
    const tokensToAnalyze = candidateTokens.slice(0, 10)

    for (const token of tokensToAnalyze) {
      try {
        const analysis = await birdeye.analyzeToken(token.id)

        // Log to token_analyses table
        const { error: analysisError } = await supabase
          .from('token_analyses')
          .insert({
            token_mint: token.id,
            token_symbol: token.symbol,
            token_name: token.name,
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
          console.error(`Failed to log analysis for ${token.symbol}:`, analysisError)
        }

        analysisResults.push({ token, analysis })

        // Delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (err) {
        analysisResults.push({
          token,
          error: err instanceof Error ? err.message : 'Analysis failed',
        })
      }
    }

    // Add skipped tokens to results
    for (const token of trending) {
      if (!tokensToAnalyze.includes(token)) {
        let skipReason = 'Not in top 10 candidates'
        if (token.isSus) skipReason = 'Flagged as suspicious'
        else if (token.mintAuthority) skipReason = 'Has mint authority'
        else if (token.freezeAuthority) skipReason = 'Has freeze authority'
        else if (token.liquidity < 10000) skipReason = 'Low liquidity'
        else if (token.topHolderPercentage > 50) skipReason = 'High holder concentration'

        analysisResults.push({
          token,
          skipped: true,
          skipReason,
        })
      }
    }

    // Sort by scalping score (best opportunities first)
    analysisResults.sort((a, b) => {
      const scoreA = a.analysis?.scalpingScore || 0
      const scoreB = b.analysis?.scalpingScore || 0
      return scoreB - scoreA
    })

    // Find best opportunities (strong_buy or buy signals with good scores)
    const topOpportunities = analysisResults.filter(r =>
      r.analysis &&
      r.analysis.scalpingScore >= 60 &&
      (r.analysis.entrySignal === 'strong_buy' || r.analysis.entrySignal === 'buy')
    )

    // Send email notification if there are good opportunities
    if (topOpportunities.length > 0) {
      try {
        // Get all users with wallet configs (active traders)
        const { data: walletUsers } = await supabase
          .from('wallet_config')
          .select('user_id')

        if (walletUsers && walletUsers.length > 0) {
          for (const walletUser of walletUsers) {
            const { data: userData } = await supabase.auth.admin.getUserById(walletUser.user_id)
            const userEmail = userData?.user?.email

            if (userEmail) {
              await sendTrendingOpportunitiesEmail({
                to: userEmail,
                opportunities: topOpportunities.map(o => ({
                  symbol: o.token.symbol,
                  mint: o.token.id,
                  scalpingScore: o.analysis!.scalpingScore,
                  entrySignal: o.analysis!.entrySignal,
                  currentPrice: o.analysis!.currentPrice,
                  expectedProfit: o.analysis!.expectedProfitAtCurrent,
                  trend: o.analysis!.trend,
                })),
              })
            }
          }
        }
      } catch (emailErr) {
        console.error('Failed to send opportunities email:', emailErr)
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      totalTrending: trending.length,
      analyzed: tokensToAnalyze.length,
      topOpportunities: topOpportunities.map(o => ({
        symbol: o.token.symbol,
        mint: o.token.id,
        scalpingScore: o.analysis!.scalpingScore,
        entrySignal: o.analysis!.entrySignal,
        currentPrice: o.analysis!.currentPrice,
        optimalEntry: o.analysis!.optimalEntryPrice,
        currentVsOptimal: o.analysis!.currentVsOptimalPercent,
        expectedProfit: o.analysis!.expectedProfitAtCurrent,
        trend: o.analysis!.trend,
        liquidity: o.token.liquidity,
      })),
      allResults: analysisResults.map(r => ({
        symbol: r.token.symbol,
        mint: r.token.id,
        scalpingScore: r.analysis?.scalpingScore,
        entrySignal: r.analysis?.entrySignal,
        error: r.error,
        skipped: r.skipped,
        skipReason: r.skipReason,
      })),
    })
  } catch (err) {
    console.error('Cron analyze-trending error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Cron job failed' },
      { status: 500 }
    )
  }
}
