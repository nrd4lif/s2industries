import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { JupiterClient } from '@/lib/jupiter'
import { decryptPrivateKey } from '@/lib/crypto'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const user = await requireAuth()
    const supabase = await createClient()

    // Check for force flag (to cancel without selling)
    const url = new URL(request.url)
    const forceCancel = url.searchParams.get('force') === 'true'

    // Get the plan
    const { data: plan, error: planError } = await supabase
      .from('trading_plans')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
    }

    // If plan is not active or has no tokens, just cancel it
    if (plan.status !== 'active' || !plan.amount_tokens) {
      const { error: updateError } = await supabase
        .from('trading_plans')
        .update({ status: 'cancelled' })
        .eq('id', id)

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to cancel plan' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        positionClosed: false,
        message: 'Plan cancelled (no active position to close)',
      })
    }

    // Plan is active with tokens - need to close position
    // Unless force=true, in which case just mark cancelled
    if (forceCancel) {
      await supabase
        .from('trading_plans')
        .update({ status: 'cancelled' })
        .eq('id', id)

      return NextResponse.json({
        success: true,
        positionClosed: false,
        message: 'Plan cancelled WITHOUT selling tokens. Tokens remain in wallet.',
        warning: 'You still hold the tokens - sell them manually or create a new plan.',
        tokensHeld: plan.amount_tokens,
        tokenMint: plan.token_mint,
        tokenSymbol: plan.token_symbol,
      })
    }

    // Get wallet
    const { data: wallet } = await supabase
      .from('wallet_config')
      .select('public_key, encrypted_private_key')
      .eq('user_id', user.id)
      .single()

    if (!wallet) {
      return NextResponse.json(
        {
          error: 'Wallet not configured',
          canRetry: false,
        },
        { status: 400 }
      )
    }

    const privateKey = decryptPrivateKey(wallet.encrypted_private_key)
    const jupiter = new JupiterClient(process.env.JUPITER_API_KEY || '')

    // Get sell quote
    let quote
    try {
      quote = await jupiter.getSellQuote({
        inputMint: plan.token_mint,
        amountTokens: plan.amount_tokens.toString(),
        taker: wallet.public_key,
      })
    } catch (quoteErr) {
      console.error('Failed to get sell quote:', quoteErr)
      return NextResponse.json(
        {
          error: 'Failed to get sell quote from Jupiter',
          details: quoteErr instanceof Error ? quoteErr.message : 'Unknown error',
          canRetry: true,
          retryMessage: 'Try again, or use ?force=true to cancel without selling',
        },
        { status: 500 }
      )
    }

    if (!quote.transaction) {
      return NextResponse.json(
        {
          error: 'Jupiter returned no transaction - token may have no liquidity',
          canRetry: true,
          retryMessage: 'Try again later, or use ?force=true to cancel without selling (tokens stay in wallet)',
        },
        { status: 500 }
      )
    }

    // Execute the sell
    let result
    try {
      result = await jupiter.signAndExecute({
        orderResponse: quote,
        privateKey,
      })
    } catch (execErr) {
      console.error('Failed to execute sell:', execErr)
      return NextResponse.json(
        {
          error: 'Failed to execute sell transaction',
          details: execErr instanceof Error ? execErr.message : 'Unknown error',
          canRetry: true,
          retryMessage: 'Transaction failed. Try again, or use ?force=true to cancel without selling',
        },
        { status: 500 }
      )
    }

    if (result.status !== 'Success') {
      return NextResponse.json(
        {
          error: 'Sell transaction failed',
          details: result.error || 'Transaction was not successful',
          canRetry: true,
          retryMessage: 'Try again, or use ?force=true to cancel without selling',
        },
        { status: 500 }
      )
    }

    // Success! Calculate P&L and update
    const solReceived = parseInt(result.outputAmountResult) / 1_000_000_000
    const profitLossSol = solReceived - plan.amount_sol
    const profitLossPercent = (profitLossSol / plan.amount_sol) * 100

    // Get current price for accurate exit price
    let exitPriceUsd = 0
    try {
      exitPriceUsd = await jupiter.getTokenPrice(plan.token_mint)
    } catch {
      // Fallback to quote value
      exitPriceUsd = quote.inUsdValue / parseInt(plan.amount_tokens.toString())
    }

    // Update plan as cancelled with exit info
    await supabase
      .from('trading_plans')
      .update({
        status: 'cancelled',
        exit_tx_signature: result.signature,
        exit_price_usd: exitPriceUsd,
        profit_loss_sol: profitLossSol,
        profit_loss_percent: profitLossPercent,
        triggered_at: new Date().toISOString(),
      })
      .eq('id', id)

    // Log the trade
    await supabase.from('trades').insert({
      user_id: user.id,
      trading_plan_id: id,
      token_mint: plan.token_mint,
      token_symbol: plan.token_symbol,
      side: 'sell',
      amount_in: plan.amount_tokens,
      amount_out: solReceived,
      input_mint: plan.token_mint,
      output_mint: 'So11111111111111111111111111111111111111112',
      price_usd: exitPriceUsd,
      tx_signature: result.signature,
    })

    return NextResponse.json({
      success: true,
      positionClosed: true,
      message: 'Position closed and plan cancelled',
      solReceived,
      profitLossSol,
      profitLossPercent,
      txSignature: result.signature,
    })
  } catch (err) {
    console.error('Cancel plan error:', err)
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Failed to cancel plan',
        canRetry: true,
        retryMessage: 'Unexpected error. Try again, or use ?force=true to cancel without selling',
      },
      { status: 500 }
    )
  }
}
