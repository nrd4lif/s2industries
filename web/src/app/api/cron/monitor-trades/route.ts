import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { JupiterClient } from '@/lib/jupiter'
import { decryptPrivateKey } from '@/lib/crypto'

// Use service role for cron job (bypasses RLS)
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const jupiter = new JupiterClient(process.env.JUPITER_API_KEY || '')

  try {
    // Get all active trading plans
    const { data: activePlans, error: plansError } = await supabase
      .from('trading_plans')
      .select('*')
      .eq('status', 'active')

    if (plansError) {
      console.error('Failed to fetch active plans:', plansError)
      return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 })
    }

    if (!activePlans || activePlans.length === 0) {
      return NextResponse.json({ message: 'No active plans', processed: 0 })
    }

    const results: Array<{ planId: string; action: string; success: boolean; error?: string }> = []

    for (const plan of activePlans) {
      try {
        // Get wallet config for this user
        const { data: wallet, error: walletError } = await supabase
          .from('wallet_config')
          .select('public_key, encrypted_private_key')
          .eq('user_id', plan.user_id)
          .single()

        if (walletError || !wallet) {
          console.error(`No wallet found for user ${plan.user_id}`)
          results.push({
            planId: plan.id,
            action: 'error',
            success: false,
            error: 'No wallet configured',
          })
          continue
        }

        // Get current price quote
        const quote = await jupiter.getQuote({
          outputMint: plan.token_mint,
          amountSol: 0.001, // Small amount just to get price
          taker: wallet.public_key,
        })

        const tokensForSmallAmount = parseInt(quote.outAmount)
        const currentPriceUsd = quote.outUsdValue / tokensForSmallAmount

        // Log price snapshot
        await supabase.from('price_snapshots').insert({
          token_mint: plan.token_mint,
          price_usd: currentPriceUsd,
          source: 'jupiter',
        })

        // Check if stop-loss or take-profit triggered
        let triggered: 'stop_loss' | 'take_profit' | null = null

        if (currentPriceUsd <= plan.stop_loss_price) {
          triggered = 'stop_loss'
        } else if (currentPriceUsd >= plan.take_profit_price) {
          triggered = 'take_profit'
        }

        if (triggered && plan.amount_tokens) {
          // Execute exit trade
          const privateKey = decryptPrivateKey(wallet.encrypted_private_key)

          const sellQuote = await jupiter.getSellQuote({
            inputMint: plan.token_mint,
            amountTokens: plan.amount_tokens.toString(),
            taker: wallet.public_key,
          })

          if (!sellQuote.transaction) {
            results.push({
              planId: plan.id,
              action: triggered,
              success: false,
              error: 'No transaction returned',
            })
            continue
          }

          const result = await jupiter.signAndExecute({
            orderResponse: sellQuote,
            privateKey,
          })

          if (result.status !== 'Success') {
            results.push({
              planId: plan.id,
              action: triggered,
              success: false,
              error: result.error,
            })
            continue
          }

          // Calculate P&L
          const solReceived = parseInt(result.outputAmountResult) / 1_000_000_000
          const profitLossSol = solReceived - plan.amount_sol
          const profitLossPercent = (profitLossSol / plan.amount_sol) * 100

          // Update plan as completed
          await supabase
            .from('trading_plans')
            .update({
              status: 'completed',
              triggered_by: triggered,
              triggered_at: new Date().toISOString(),
              exit_tx_signature: result.signature,
              exit_price_usd: currentPriceUsd,
              profit_loss_sol: profitLossSol,
              profit_loss_percent: profitLossPercent,
            })
            .eq('id', plan.id)

          // Log the trade
          await supabase.from('trades').insert({
            user_id: plan.user_id,
            trading_plan_id: plan.id,
            token_mint: plan.token_mint,
            token_symbol: plan.token_symbol,
            side: 'sell',
            amount_in: plan.amount_tokens,
            amount_out: solReceived,
            input_mint: plan.token_mint,
            output_mint: 'So11111111111111111111111111111111111111112',
            price_usd: currentPriceUsd,
            tx_signature: result.signature,
          })

          results.push({
            planId: plan.id,
            action: triggered,
            success: true,
          })
        } else {
          results.push({
            planId: plan.id,
            action: 'monitoring',
            success: true,
          })
        }

        // Small delay between plans to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (err) {
        console.error(`Error processing plan ${plan.id}:`, err)
        results.push({
          planId: plan.id,
          action: 'error',
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      processed: activePlans.length,
      results,
    })
  } catch (err) {
    console.error('Cron job error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Cron job failed' },
      { status: 500 }
    )
  }
}
