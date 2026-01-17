import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/auth'
import { JupiterClient, TrendingCategory, TrendingInterval } from '@/lib/jupiter'
import { BirdeyeClient } from '@/lib/birdeye'

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
    const category = (searchParams.get('category') || 'toptrending') as TrendingCategory
    const interval = (searchParams.get('interval') || '1h') as TrendingInterval
    const limit = parseInt(searchParams.get('limit') || '20')
    const analyzeTop = searchParams.get('analyze') === 'true'
    const cached = searchParams.get('cached') === 'true'  // Return cached data only

    // Validate params
    const validCategories: TrendingCategory[] = ['toptrending', 'toptraded', 'toporganicscore']
    const validIntervals: TrendingInterval[] = ['5m', '1h', '6h', '24h']

    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Use: ${validCategories.join(', ')}` },
        { status: 400 }
      )
    }

    if (!validIntervals.includes(interval)) {
      return NextResponse.json(
        { error: `Invalid interval. Use: ${validIntervals.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // If requesting cached data, return from database
    if (cached) {
      // Get the most recent snapshot timestamp for this category/interval
      const { data: latestSnapshot } = await supabase
        .from('trending_snapshots')
        .select('created_at')
        .eq('category', category)
        .eq('interval', interval)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!latestSnapshot) {
        return NextResponse.json({
          trending: [],
          analyses: [],
          category,
          interval,
          count: 0,
          fetchedAt: null,
          cached: true,
        })
      }

      // Get all tokens from that snapshot
      const { data: cachedTrending } = await supabase
        .from('trending_snapshots')
        .select('*')
        .eq('category', category)
        .eq('interval', interval)
        .eq('created_at', latestSnapshot.created_at)
        .order('rank_position', { ascending: true })
        .limit(limit)

      // Get cached analyses for these tokens (most recent for each)
      const tokenMints = cachedTrending?.map(t => t.token_mint) || []
      let cachedAnalyses: Array<{
        token_mint: string
        scalping_score: number
        scalping_verdict: string
        entry_signal: string
        entry_signal_reason: string
        optimal_entry_price: number
        current_vs_optimal_percent: number
        expected_profit_at_current: number
        trend: string
        created_at: string
      }> = []

      if (tokenMints.length > 0) {
        // Get most recent analysis for each token
        const { data: analyses } = await supabase
          .from('token_analyses')
          .select('token_mint, scalping_score, scalping_verdict, entry_signal, entry_signal_reason, optimal_entry_price, current_vs_optimal_percent, expected_profit_at_current, trend, created_at')
          .in('token_mint', tokenMints)
          .order('created_at', { ascending: false })

        // Dedupe to get only most recent per token
        const seenMints = new Set<string>()
        cachedAnalyses = (analyses || []).filter(a => {
          if (seenMints.has(a.token_mint)) return false
          seenMints.add(a.token_mint)
          return true
        })
      }

      // Transform cached data to match fresh data format
      const trending = (cachedTrending || []).map(t => ({
        id: t.token_mint,
        symbol: t.token_symbol,
        name: t.token_name,
        icon: '',  // Not stored in cache
        decimals: 9,
        usdPrice: t.usd_price,
        mcap: t.market_cap,
        fdv: t.fdv,
        liquidity: t.liquidity,
        stats1h: {
          priceChange: t.price_change_percent,
          volume: t.volume,
          buyVolume: t.buy_volume,
          sellVolume: t.sell_volume,
          numBuys: t.num_buys,
          numSells: t.num_sells,
          holderChange: 0,
          liquidityChange: 0,
        },
        isSus: t.is_sus,
        mintAuthority: t.mint_authority,
        freezeAuthority: t.freeze_authority,
        topHolderPercentage: t.top_holder_percentage,
        isVerified: t.is_verified,
      }))

      // Build analyses array
      const analyses = cachedAnalyses.map(a => {
        const token = trending.find(t => t.id === a.token_mint)
        return {
          token: token || { id: a.token_mint, symbol: 'Unknown', name: '', icon: '', decimals: 9, usdPrice: 0, mcap: 0, fdv: 0, liquidity: 0, stats1h: { priceChange: 0, volume: 0, buyVolume: 0, sellVolume: 0, numBuys: 0, numSells: 0, holderChange: 0, liquidityChange: 0 }, isSus: false, mintAuthority: false, freezeAuthority: false, topHolderPercentage: 0, isVerified: false },
          analysis: {
            scalpingScore: a.scalping_score,
            scalpingVerdict: a.scalping_verdict,
            entrySignal: a.entry_signal,
            entrySignalReason: a.entry_signal_reason,
            optimalEntryPrice: a.optimal_entry_price,
            currentVsOptimalPercent: a.current_vs_optimal_percent,
            expectedProfitAtCurrent: a.expected_profit_at_current,
            trend: a.trend,
          },
        }
      }).filter(a => a.token)

      return NextResponse.json({
        trending,
        analyses: analyses.length > 0 ? analyses : undefined,
        category,
        interval,
        count: trending.length,
        fetchedAt: latestSnapshot.created_at,
        cached: true,
      })
    }

    // Fresh fetch from Jupiter API
    const jupiterApiKey = process.env.JUPITER_API_KEY
    if (!jupiterApiKey) {
      return NextResponse.json(
        { error: 'Jupiter API key not configured' },
        { status: 500 }
      )
    }

    const jupiter = new JupiterClient(jupiterApiKey)
    const trending = await jupiter.getTrendingTokens({
      category,
      interval,
      limit: Math.min(limit, 50),  // Cap at 50 to avoid rate limits
    })

    const fetchedAt = new Date().toISOString()

    // Log trending snapshot
    const snapshotRows = trending.map((token, index) => ({
      token_mint: token.id,
      token_symbol: token.symbol,
      token_name: token.name,
      category,
      interval,
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

    await supabase.from('trending_snapshots').insert(snapshotRows)

    // If analyzeTop is true, run Birdeye analysis on top tokens
    let analyses: Array<{
      token: typeof trending[0]
      analysis?: Awaited<ReturnType<BirdeyeClient['analyzeToken']>>
      error?: string
    }> = []

    if (analyzeTop) {
      const birdeyeApiKey = process.env.BIRDEYE_API_KEY
      if (!birdeyeApiKey) {
        return NextResponse.json({
          trending,
          analyses: [],
          warning: 'Birdeye API key not configured - skipping analysis',
        })
      }

      const birdeye = new BirdeyeClient(birdeyeApiKey)

      // Analyze top 5 tokens (to stay within rate limits)
      const tokensToAnalyze = trending.slice(0, 5)

      for (const token of tokensToAnalyze) {
        try {
          // Skip tokens with red flags
          if (token.isSus || token.mintAuthority || token.freezeAuthority) {
            analyses.push({
              token,
              error: 'Skipped - security red flags (isSus, mintAuthority, or freezeAuthority)',
            })
            continue
          }

          const analysis = await birdeye.analyzeToken(token.id)
          analyses.push({ token, analysis })

          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 300))
        } catch (err) {
          analyses.push({
            token,
            error: err instanceof Error ? err.message : 'Analysis failed',
          })
        }
      }

      // Sort by scalping score (highest first)
      analyses.sort((a, b) => {
        const scoreA = a.analysis?.scalpingScore || 0
        const scoreB = b.analysis?.scalpingScore || 0
        return scoreB - scoreA
      })
    }

    return NextResponse.json({
      trending,
      analyses: analyzeTop ? analyses : undefined,
      category,
      interval,
      count: trending.length,
      fetchedAt,
      cached: false,
    })
  } catch (err) {
    console.error('Trending tokens error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch trending tokens' },
      { status: 500 }
    )
  }
}
