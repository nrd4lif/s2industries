import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { JupiterClient } from '@/lib/jupiter'
import { decryptPrivateKey } from '@/lib/crypto'
import { sendTradeExecutedEmail } from '@/lib/email'

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

  const results: Array<{ planId: string; action: string; success: boolean; error?: string }> = []

  try {
    // ========================================
    // PART 1: Process waiting_entry plans (limit buy orders)
    // ========================================
    const { data: waitingPlans, error: waitingError } = await supabase
      .from('trading_plans')
      .select('*')
      .eq('status', 'waiting_entry')

    if (waitingError) {
      console.error('Failed to fetch waiting plans:', waitingError)
    }

    if (waitingPlans && waitingPlans.length > 0) {
      for (const plan of waitingPlans) {
        try {
          // Check if expired
          const waitingSince = new Date(plan.waiting_since)
          const maxWaitMs = (plan.max_wait_hours || 24) * 60 * 60 * 1000
          const now = new Date()

          if (now.getTime() - waitingSince.getTime() > maxWaitMs) {
            // Expired - update status
            await supabase
              .from('trading_plans')
              .update({ status: 'expired' })
              .eq('id', plan.id)

            results.push({
              planId: plan.id,
              action: 'expired',
              success: true,
            })
            continue
          }

          // Get wallet
          const { data: wallet, error: walletError } = await supabase
            .from('wallet_config')
            .select('public_key, encrypted_private_key')
            .eq('user_id', plan.user_id)
            .single()

          if (walletError || !wallet) {
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
            amountSol: plan.amount_sol,
            taker: wallet.public_key,
          })

          const tokensForAmount = parseInt(quote.outAmount)
          const currentPriceUsd = quote.outUsdValue / tokensForAmount

          // Log price snapshot
          await supabase.from('price_snapshots').insert({
            token_mint: plan.token_mint,
            price_usd: currentPriceUsd,
            source: 'jupiter',
          })

          // Check if price is within threshold of target
          const targetPrice = plan.target_entry_price
          const thresholdPercent = plan.entry_threshold_percent || 1.0
          const priceDiffPercent = ((currentPriceUsd - targetPrice) / targetPrice) * 100

          // Buy if price is at or below target (within threshold)
          if (priceDiffPercent <= thresholdPercent) {
            // Price hit! Execute buy
            const privateKey = decryptPrivateKey(wallet.encrypted_private_key)

            if (!quote.transaction) {
              results.push({
                planId: plan.id,
                action: 'waiting_entry',
                success: false,
                error: 'No transaction returned',
              })
              continue
            }

            const result = await jupiter.signAndExecute({
              orderResponse: quote,
              privateKey,
            })

            if (result.status !== 'Success') {
              results.push({
                planId: plan.id,
                action: 'buy_failed',
                success: false,
                error: result.error,
              })
              continue
            }

            // Calculate actual entry price
            const tokensReceived = parseInt(result.outputAmountResult || quote.outAmount)
            const actualEntryPrice = quote.outUsdValue / tokensReceived

            // Update plan to active
            await supabase
              .from('trading_plans')
              .update({
                status: 'active',
                amount_tokens: tokensReceived,
                entry_price_usd: actualEntryPrice,
                stop_loss_price: actualEntryPrice * (1 - plan.stop_loss_percent / 100),
                take_profit_price: actualEntryPrice * (1 + plan.take_profit_percent / 100),
                entry_tx_signature: result.signature,
              })
              .eq('id', plan.id)

            // Log the buy trade
            await supabase.from('trades').insert({
              user_id: plan.user_id,
              trading_plan_id: plan.id,
              token_mint: plan.token_mint,
              token_symbol: plan.token_symbol,
              side: 'buy',
              amount_in: plan.amount_sol,
              amount_out: tokensReceived,
              input_mint: 'So11111111111111111111111111111111111111112',
              output_mint: plan.token_mint,
              price_usd: actualEntryPrice,
              tx_signature: result.signature,
            })

            results.push({
              planId: plan.id,
              action: 'limit_buy_executed',
              success: true,
            })
          } else {
            results.push({
              planId: plan.id,
              action: 'waiting_entry',
              success: true,
            })
          }

          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (err) {
          console.error(`Error processing waiting plan ${plan.id}:`, err)
          results.push({
            planId: plan.id,
            action: 'error',
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          })
        }
      }
    }

    // ========================================
    // PART 2: Process active plans (monitor for exit)
    // ========================================
    const { data: activePlans, error: plansError } = await supabase
      .from('trading_plans')
      .select('*')
      .eq('status', 'active')

    if (plansError) {
      console.error('Failed to fetch active plans:', plansError)
      return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 })
    }

    if (!activePlans || activePlans.length === 0) {
      return NextResponse.json({
        message: 'No active plans',
        processed: results.length,
        results,
      })
    }

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

          // Send email notification
          try {
            // Get user email from Supabase Auth
            const { data: userData } = await supabase.auth.admin.getUserById(plan.user_id)
            const userEmail = userData?.user?.email

            if (userEmail) {
              await sendTradeExecutedEmail({
                to: userEmail,
                tokenSymbol: plan.token_symbol || 'Unknown',
                tokenMint: plan.token_mint,
                triggeredBy: triggered,
                entryPriceSol: plan.amount_sol / (plan.amount_tokens || 1),
                exitPriceSol: solReceived / (plan.amount_tokens || 1),
                amountSol: plan.amount_sol,
                profitLossSol,
                profitLossPercent,
                txSignature: result.signature,
              })
            }
          } catch (emailErr) {
            console.error('Failed to send trade email:', emailErr)
            // Don't fail the whole operation if email fails
          }

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
      processed: (waitingPlans?.length || 0) + activePlans.length,
      waitingPlans: waitingPlans?.length || 0,
      activePlans: activePlans.length,
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
