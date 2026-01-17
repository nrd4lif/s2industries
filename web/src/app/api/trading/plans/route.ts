import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { createTradingPlanSchema } from '@/lib/validators'
import { JupiterClient } from '@/lib/jupiter'

export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { data: plans, error } = await supabase
      .from('trading_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 })
    }

    return NextResponse.json({ plans })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()

    const input = createTradingPlanSchema.parse(body)

    const supabase = await createClient()

    // Get wallet
    const { data: wallet } = await supabase
      .from('wallet_config')
      .select('public_key')
      .eq('user_id', user.id)
      .single()

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not configured' },
        { status: 400 }
      )
    }

    // Get current quote to store entry price
    const jupiter = new JupiterClient(process.env.JUPITER_API_KEY || '')
    const quote = await jupiter.getQuote({
      outputMint: input.token_mint,
      amountSol: input.amount_sol,
      taker: wallet.public_key,
    })

    // Get token info
    const tokens = await jupiter.searchToken(input.token_mint)
    const tokenInfo = tokens.find(t => t.mint === input.token_mint)

    // Calculate entry price per token
    const tokensReceived = parseInt(quote.outAmount)
    const entryPriceUsd = quote.outUsdValue / tokensReceived

    // Calculate trigger prices
    const stopLossPrice = entryPriceUsd * (1 - input.stop_loss_percent / 100)
    const takeProfitPrice = entryPriceUsd * (1 + input.take_profit_percent / 100)

    // Create plan in draft status
    const { data: plan, error } = await supabase
      .from('trading_plans')
      .insert({
        user_id: user.id,
        token_mint: input.token_mint,
        token_symbol: tokenInfo?.symbol || null,
        token_name: tokenInfo?.name || null,
        entry_price_usd: entryPriceUsd,
        amount_sol: input.amount_sol,
        stop_loss_percent: input.stop_loss_percent,
        take_profit_percent: input.take_profit_percent,
        stop_loss_price: stopLossPrice,
        take_profit_price: takeProfitPrice,
        status: 'draft',
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create plan:', error)
      return NextResponse.json(
        { error: 'Failed to create trading plan' },
        { status: 500 }
      )
    }

    return NextResponse.json({ plan })
  } catch (err) {
    console.error('Create plan error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid request' },
      { status: 400 }
    )
  }
}
