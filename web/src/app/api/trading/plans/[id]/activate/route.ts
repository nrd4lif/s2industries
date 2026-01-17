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

    // Get the plan
    const { data: plan, error: planError } = await supabase
      .from('trading_plans')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('status', 'draft')
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found or not in draft status' },
        { status: 404 }
      )
    }

    // Get wallet with encrypted private key
    const { data: wallet, error: walletError } = await supabase
      .from('wallet_config')
      .select('public_key, encrypted_private_key')
      .eq('user_id', user.id)
      .single()

    if (walletError || !wallet) {
      return NextResponse.json(
        { error: 'Wallet not configured' },
        { status: 400 }
      )
    }

    // Decrypt private key
    const privateKey = decryptPrivateKey(wallet.encrypted_private_key)

    // Get fresh quote and execute entry trade
    const jupiter = new JupiterClient(process.env.JUPITER_API_KEY || '')

    const quote = await jupiter.getQuote({
      outputMint: plan.token_mint,
      amountSol: plan.amount_sol,
      taker: wallet.public_key,
    })

    if (!quote.transaction) {
      return NextResponse.json(
        { error: 'Failed to get swap transaction' },
        { status: 500 }
      )
    }

    // Execute the swap
    const result = await jupiter.signAndExecute({
      orderResponse: quote,
      privateKey,
    })

    if (result.status !== 'Success') {
      return NextResponse.json(
        { error: result.error || 'Swap failed' },
        { status: 500 }
      )
    }

    // Calculate actual entry price
    const tokensReceived = parseInt(result.outputAmountResult || quote.outAmount)
    const entryPriceUsd = quote.outUsdValue / tokensReceived

    // Update plan to active
    const { error: updateError } = await supabase
      .from('trading_plans')
      .update({
        status: 'active',
        amount_tokens: tokensReceived,
        entry_price_usd: entryPriceUsd,
        stop_loss_price: entryPriceUsd * (1 - plan.stop_loss_percent / 100),
        take_profit_price: entryPriceUsd * (1 + plan.take_profit_percent / 100),
        entry_tx_signature: result.signature,
      })
      .eq('id', id)

    if (updateError) {
      console.error('Failed to update plan:', updateError)
      // Trade executed but failed to update - log this
      return NextResponse.json(
        { error: 'Trade executed but failed to update plan. Check transaction: ' + result.signature },
        { status: 500 }
      )
    }

    // Log the trade
    await supabase.from('trades').insert({
      user_id: user.id,
      trading_plan_id: id,
      token_mint: plan.token_mint,
      token_symbol: plan.token_symbol,
      side: 'buy',
      amount_in: plan.amount_sol,
      amount_out: tokensReceived,
      input_mint: 'So11111111111111111111111111111111111111112',
      output_mint: plan.token_mint,
      price_usd: entryPriceUsd,
      tx_signature: result.signature,
    })

    return NextResponse.json({
      success: true,
      signature: result.signature,
      tokensReceived,
      entryPrice: entryPriceUsd,
    })
  } catch (err) {
    console.error('Activate plan error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to activate plan' },
      { status: 500 }
    )
  }
}
