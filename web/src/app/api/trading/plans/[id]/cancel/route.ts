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
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
    }

    // If plan is active, we need to close the position first
    if (plan.status === 'active' && plan.amount_tokens) {
      // Get wallet
      const { data: wallet } = await supabase
        .from('wallet_config')
        .select('public_key, encrypted_private_key')
        .eq('user_id', user.id)
        .single()

      if (!wallet) {
        return NextResponse.json(
          { error: 'Wallet not configured' },
          { status: 400 }
        )
      }

      const privateKey = decryptPrivateKey(wallet.encrypted_private_key)
      const jupiter = new JupiterClient(process.env.JUPITER_API_KEY || '')

      // Sell all tokens back to SOL
      const quote = await jupiter.getSellQuote({
        inputMint: plan.token_mint,
        amountTokens: plan.amount_tokens.toString(),
        taker: wallet.public_key,
      })

      if (quote.transaction) {
        const result = await jupiter.signAndExecute({
          orderResponse: quote,
          privateKey,
        })

        if (result.status === 'Success') {
          // Calculate P&L
          const solReceived = parseInt(result.outputAmountResult) / 1_000_000_000
          const profitLossSol = solReceived - plan.amount_sol
          const profitLossPercent = (profitLossSol / plan.amount_sol) * 100

          // Update plan as cancelled with exit info
          await supabase
            .from('trading_plans')
            .update({
              status: 'cancelled',
              exit_tx_signature: result.signature,
              exit_price_usd: quote.inUsdValue / parseInt(plan.amount_tokens.toString()),
              profit_loss_sol: profitLossSol,
              profit_loss_percent: profitLossPercent,
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
            price_usd: quote.inUsdValue / parseInt(plan.amount_tokens.toString()),
            tx_signature: result.signature,
          })

          return NextResponse.json({ success: true, closed: true })
        }
      }
    }

    // Just mark as cancelled if draft or if close failed
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

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Cancel plan error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to cancel plan' },
      { status: 500 }
    )
  }
}
