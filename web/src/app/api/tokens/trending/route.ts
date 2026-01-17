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

    // Log to database
    const supabase = createServiceClient()

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
    })
  } catch (err) {
    console.error('Trending tokens error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch trending tokens' },
      { status: 500 }
    )
  }
}
