import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { JupiterClient } from '@/lib/jupiter'

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const mint = searchParams.get('mint')
    const amount = searchParams.get('amount') || '1'

    if (!mint) {
      return NextResponse.json(
        { error: 'Mint address required' },
        { status: 400 }
      )
    }

    // Get user's wallet
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

    const jupiter = new JupiterClient(process.env.JUPITER_API_KEY || '')
    const order = await jupiter.getQuote({
      outputMint: mint,
      amountSol: parseFloat(amount),
      taker: wallet.public_key,
    })

    // Calculate price per token
    const tokensReceived = parseInt(order.outAmount)
    const priceUsd = order.inUsdValue / tokensReceived

    return NextResponse.json({
      quote: {
        priceUsd: order.outUsdValue / tokensReceived,
        outAmount: order.outAmount,
        slippageBps: order.slippageBps,
        priceImpact: order.priceImpact,
        inUsdValue: order.inUsdValue,
        outUsdValue: order.outUsdValue,
      }
    })
  } catch (err) {
    console.error('Quote error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get quote' },
      { status: 500 }
    )
  }
}
