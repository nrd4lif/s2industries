import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { JupiterClient } from '@/lib/jupiter'
import { decryptPrivateKey } from '@/lib/crypto'
import { sendTradeExecutedEmail, sendTradeEntryEmail } from '@/lib/email'

// Use service role for cron job (bypasses RLS)
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Helper to get today's P&L for a user
async function getTodaysPnL(supabase: ReturnType<typeof createServiceClient>, userId: string): Promise<number> {
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('trading_plans')
    .select('profit_loss_sol')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('triggered_at', todayStart.toISOString())

  if (!data) return 0
  return data.reduce((sum, plan) => sum + (plan.profit_loss_sol || 0), 0)
}

// Helper to get user settings
async function getUserSettings(supabase: ReturnType<typeof createServiceClient>, userId: string) {
  const { data } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  // Return defaults if no settings found
  return data || {
    daily_loss_limit_sol: 0.5,
    daily_loss_limit_enabled: true,
    max_concurrent_trades: 5,
    max_position_size_sol: 1.0,
  }
}

// Helper to check if daily loss limit exceeded
async function isDailyLossLimitExceeded(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<{ exceeded: boolean; currentLoss: number; limit: number }> {
  const settings = await getUserSettings(supabase, userId)

  if (!settings.daily_loss_limit_enabled) {
    return { exceeded: false, currentLoss: 0, limit: 0 }
  }

  const todaysPnL = await getTodaysPnL(supabase, userId)
  const limit = settings.daily_loss_limit_sol

  // Check if loss exceeds limit (todaysPnL is negative for losses)
  return {
    exceeded: todaysPnL < -limit,
    currentLoss: Math.abs(Math.min(0, todaysPnL)),
    limit,
  }
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const jupiter = new JupiterClient(process.env.JUPITER_API_KEY || '')

  const results: Array<{ planId: string; action: string; success: boolean; error?: string; details?: string }> = []

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

          // Check daily loss limit before entering new trades
          const lossCheck = await isDailyLossLimitExceeded(supabase, plan.user_id)
          if (lossCheck.exceeded) {
            results.push({
              planId: plan.id,
              action: 'blocked_by_daily_limit',
              success: false,
              error: `Daily loss limit exceeded (${lossCheck.currentLoss.toFixed(4)} / ${lossCheck.limit} SOL)`,
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

          // Get current market price using Jupiter Price API
          const currentPriceUsd = await jupiter.getTokenPrice(plan.token_mint)

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

          console.log(`Limit order check for ${plan.token_symbol || plan.token_mint}:`, {
            currentPriceUsd,
            targetPrice,
            priceDiffPercent: priceDiffPercent.toFixed(2) + '%',
            threshold: thresholdPercent + '%',
            shouldExecute: priceDiffPercent <= thresholdPercent,
          })

          // Buy if price is at or below target (within threshold)
          if (priceDiffPercent <= thresholdPercent) {
            // Price hit! Get quote and execute buy
            const privateKey = decryptPrivateKey(wallet.encrypted_private_key)

            const quote = await jupiter.getQuote({
              outputMint: plan.token_mint,
              amountSol: plan.amount_sol,
              taker: wallet.public_key,
            })

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

            // Use the market price we already fetched for entry price
            const tokensReceived = parseInt(result.outputAmountResult || quote.outAmount)
            const actualEntryPrice = currentPriceUsd

            // Calculate all price levels
            const stopLossPrice = actualEntryPrice * (1 - plan.stop_loss_percent / 100)
            const takeProfitPrice = actualEntryPrice * (1 + plan.take_profit_percent / 100)
            const partialProfitPrice = plan.partial_profit_price ||
              (plan.use_partial_profit ? actualEntryPrice * (1 + plan.take_profit_percent / 200) : null) // TP1 at 50% of TP

            // Update plan to active with all advanced features
            await supabase
              .from('trading_plans')
              .update({
                status: 'active',
                amount_tokens: tokensReceived,
                entry_price_usd: actualEntryPrice,
                stop_loss_price: stopLossPrice,
                take_profit_price: takeProfitPrice,
                entry_tx_signature: result.signature,
                // Initialize trailing stop tracking
                highest_price_since_entry: actualEntryPrice,
                trailing_stop_price: plan.use_trailing_stop
                  ? actualEntryPrice * (1 - (plan.trailing_stop_percent || plan.stop_loss_percent) / 100)
                  : null,
                // Partial profit
                partial_profit_price: partialProfitPrice,
                remaining_tokens: tokensReceived,
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

            // Send entry notification email
            try {
              const { data: userData } = await supabase.auth.admin.getUserById(plan.user_id)
              const userEmail = userData?.user?.email

              if (userEmail) {
                await sendTradeEntryEmail({
                  to: userEmail,
                  tokenSymbol: plan.token_symbol || 'Unknown',
                  tokenMint: plan.token_mint,
                  amountSol: plan.amount_sol,
                  tokensReceived,
                  entryPriceUsd: actualEntryPrice,
                  stopLossPercent: plan.stop_loss_percent,
                  takeProfitPercent: plan.take_profit_percent,
                  stopLossPrice,
                  takeProfitPrice,
                  txSignature: result.signature,
                  isLimitOrder: true,
                })
              }
            } catch (emailErr) {
              console.error('Failed to send limit order entry email:', emailErr)
            }

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

        // Get current market price using Jupiter Price API
        const currentPriceUsd = await jupiter.getTokenPrice(plan.token_mint)

        // Log price snapshot
        await supabase.from('price_snapshots').insert({
          token_mint: plan.token_mint,
          price_usd: currentPriceUsd,
          source: 'jupiter',
        })

        // ========================================
        // ADVANCED FEATURE: Update trailing stop
        // ========================================
        if (plan.use_trailing_stop && currentPriceUsd > (plan.highest_price_since_entry || 0)) {
          const newTrailingStop = currentPriceUsd * (1 - (plan.trailing_stop_percent || plan.stop_loss_percent) / 100)

          await supabase
            .from('trading_plans')
            .update({
              highest_price_since_entry: currentPriceUsd,
              trailing_stop_price: newTrailingStop,
            })
            .eq('id', plan.id)

          // Update local plan object for this iteration
          plan.highest_price_since_entry = currentPriceUsd
          plan.trailing_stop_price = newTrailingStop

          console.log(`Updated trailing stop for ${plan.token_symbol}:`, {
            newPeak: currentPriceUsd,
            trailingStop: newTrailingStop,
          })
        }

        // ========================================
        // ADVANCED FEATURE: Breakeven stop activation
        // ========================================
        if (plan.use_breakeven_stop && !plan.breakeven_activated) {
          const profitPercent = ((currentPriceUsd - plan.entry_price_usd) / plan.entry_price_usd) * 100
          const triggerPercent = plan.breakeven_trigger_percent || 3

          if (profitPercent >= triggerPercent) {
            // Move stop-loss to entry price (breakeven)
            await supabase
              .from('trading_plans')
              .update({
                stop_loss_price: plan.entry_price_usd,
                breakeven_activated: true,
                breakeven_activated_at: new Date().toISOString(),
              })
              .eq('id', plan.id)

            plan.stop_loss_price = plan.entry_price_usd
            plan.breakeven_activated = true

            console.log(`Breakeven stop activated for ${plan.token_symbol} at ${plan.entry_price_usd}`)

            results.push({
              planId: plan.id,
              action: 'breakeven_activated',
              success: true,
              details: `SL moved to entry price ${plan.entry_price_usd}`,
            })
          }
        }

        // ========================================
        // ADVANCED FEATURE: Time-based exit check
        // ========================================
        let timeExit = false
        if (plan.max_hold_hours && plan.entry_tx_signature) {
          // Use the created_at or updated_at timestamp to calculate hold time
          const entryTime = new Date(plan.updated_at || plan.created_at)
          const holdTimeMs = Date.now() - entryTime.getTime()
          const maxHoldMs = plan.max_hold_hours * 60 * 60 * 1000

          if (holdTimeMs >= maxHoldMs) {
            timeExit = true
            console.log(`Time-based exit triggered for ${plan.token_symbol} after ${plan.max_hold_hours}h`)
          }
        }

        // ========================================
        // ADVANCED FEATURE: Partial profit-taking
        // ========================================
        if (plan.use_partial_profit && !plan.partial_profit_taken && plan.partial_profit_price) {
          if (currentPriceUsd >= plan.partial_profit_price) {
            // Execute partial sell
            const privateKey = decryptPrivateKey(wallet.encrypted_private_key)
            const tokensToSell = Math.floor(plan.amount_tokens * (plan.partial_profit_percent || 50) / 100)
            const remainingTokens = plan.amount_tokens - tokensToSell

            const sellQuote = await jupiter.getSellQuote({
              inputMint: plan.token_mint,
              amountTokens: tokensToSell.toString(),
              taker: wallet.public_key,
            })

            if (sellQuote.transaction) {
              const result = await jupiter.signAndExecute({
                orderResponse: sellQuote,
                privateKey,
              })

              if (result.status === 'Success') {
                const solReceived = parseInt(result.outputAmountResult) / 1_000_000_000

                await supabase
                  .from('trading_plans')
                  .update({
                    partial_profit_taken: true,
                    partial_profit_taken_at: new Date().toISOString(),
                    partial_tx_signature: result.signature,
                    remaining_tokens: remainingTokens,
                    amount_tokens: remainingTokens, // Update active tokens
                  })
                  .eq('id', plan.id)

                // Log partial sell trade
                await supabase.from('trades').insert({
                  user_id: plan.user_id,
                  trading_plan_id: plan.id,
                  token_mint: plan.token_mint,
                  token_symbol: plan.token_symbol,
                  side: 'sell',
                  amount_in: tokensToSell,
                  amount_out: solReceived,
                  input_mint: plan.token_mint,
                  output_mint: 'So11111111111111111111111111111111111111112',
                  price_usd: currentPriceUsd,
                  tx_signature: result.signature,
                })

                plan.partial_profit_taken = true
                plan.amount_tokens = remainingTokens

                results.push({
                  planId: plan.id,
                  action: 'partial_profit_taken',
                  success: true,
                  details: `Sold ${plan.partial_profit_percent || 50}% (${tokensToSell} tokens) for ${solReceived.toFixed(4)} SOL`,
                })

                console.log(`Partial profit taken for ${plan.token_symbol}: ${tokensToSell} tokens sold`)
              }
            }
          }
        }

        // ========================================
        // DETERMINE EXIT TRIGGER
        // ========================================
        let triggered: 'stop_loss' | 'take_profit' | 'trailing_stop' | 'time_exit' | null = null

        // Use trailing stop price if enabled, otherwise fixed stop-loss
        const effectiveStopLoss = plan.use_trailing_stop && plan.trailing_stop_price
          ? plan.trailing_stop_price
          : plan.stop_loss_price

        if (timeExit) {
          triggered = 'time_exit'
        } else if (currentPriceUsd <= effectiveStopLoss) {
          triggered = plan.use_trailing_stop ? 'trailing_stop' : 'stop_loss'
        } else if (currentPriceUsd >= plan.take_profit_price) {
          triggered = 'take_profit'
        }

        // ========================================
        // EXECUTE EXIT IF TRIGGERED
        // ========================================
        if (triggered && plan.amount_tokens) {
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
              triggered_by: triggered === 'trailing_stop' ? 'stop_loss' : triggered === 'time_exit' ? 'stop_loss' : triggered,
              triggered_at: new Date().toISOString(),
              exit_tx_signature: result.signature,
              exit_price_usd: currentPriceUsd,
              profit_loss_sol: profitLossSol,
              profit_loss_percent: profitLossPercent,
              time_exit_triggered: triggered === 'time_exit',
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
            const { data: userData } = await supabase.auth.admin.getUserById(plan.user_id)
            const userEmail = userData?.user?.email

            if (userEmail) {
              await sendTradeExecutedEmail({
                to: userEmail,
                tokenSymbol: plan.token_symbol || 'Unknown',
                tokenMint: plan.token_mint,
                triggeredBy: triggered === 'trailing_stop' ? 'stop_loss' : triggered === 'time_exit' ? 'stop_loss' : triggered,
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
          }

          results.push({
            planId: plan.id,
            action: triggered,
            success: true,
            details: `Exit at $${currentPriceUsd.toPrecision(4)}, P&L: ${profitLossPercent >= 0 ? '+' : ''}${profitLossPercent.toFixed(2)}%`,
          })
        } else {
          results.push({
            planId: plan.id,
            action: 'monitoring',
            success: true,
            details: `Price: $${currentPriceUsd.toPrecision(4)}, SL: $${effectiveStopLoss?.toPrecision(4)}, TP: $${plan.take_profit_price?.toPrecision(4)}`,
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
