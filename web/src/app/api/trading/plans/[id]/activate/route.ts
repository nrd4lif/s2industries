import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { JupiterClient } from '@/lib/jupiter'
import { BirdeyeClient } from '@/lib/birdeye'
import { decryptPrivateKey } from '@/lib/crypto'
import { sendTradeEntryEmail } from '@/lib/email'

// Calculate profit protection defaults based on volatility
function calculateProfitProtectionDefaults(volatility: number) {
  // Clamp volatility to reasonable range (2-30%)
  const clampedVolatility = Math.max(2, Math.min(30, volatility))

  return {
    profitTriggerPercent: Math.round(clampedVolatility * 1.5 * 10) / 10,      // Start protecting at 1.5x volatility
    givebackAllowedPercent: Math.round(clampedVolatility * 0.5 * 10) / 10,   // Check MACD after 0.5x volatility drop
    hardFloorPercent: Math.round(clampedVolatility * 0.75 * 10) / 10,        // Force exit at 0.75x volatility drop
  }
}

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const user = await requireAuth()
    const supabase = await createClient()

    // Get the plan (must be in pending status)
    const { data: plan, error: planError } = await supabase
      .from('trading_plans')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found or not in pending status' },
        { status: 404 }
      )
    }

    // Check if this is a limit buy order
    const isLimitBuy = plan.target_entry_price !== null

    // Analyze token to get volatility for profit protection defaults
    let volatility = 8 // Default if analysis fails
    let profitProtectionDefaults = calculateProfitProtectionDefaults(volatility)

    try {
      const birdeye = new BirdeyeClient(process.env.BIRDEYE_API_KEY || '')
      const analysis = await birdeye.analyzeToken(plan.token_mint)
      volatility = analysis.volatility
      profitProtectionDefaults = calculateProfitProtectionDefaults(volatility)
      console.log(`Token volatility for ${plan.token_symbol}: ${volatility}%, protection defaults:`, profitProtectionDefaults)
    } catch (analysisErr) {
      console.error('Failed to analyze token for volatility:', analysisErr)
      // Continue with default volatility
    }

    // Use plan values if set, otherwise use calculated defaults
    const profitProtectionEnabled = plan.profit_protection_enabled ?? true
    const profitTriggerPercent = plan.profit_trigger_percent ?? profitProtectionDefaults.profitTriggerPercent
    const givebackAllowedPercent = plan.giveback_allowed_percent ?? profitProtectionDefaults.givebackAllowedPercent
    const hardFloorPercent = plan.hard_floor_percent ?? profitProtectionDefaults.hardFloorPercent

    if (isLimitBuy) {
      // For limit buy, transition to waiting_entry status with profit protection settings
      const { error: updateError } = await supabase
        .from('trading_plans')
        .update({
          status: 'waiting_entry',
          waiting_since: new Date().toISOString(),
          // Store profit protection settings
          profit_protection_enabled: profitProtectionEnabled,
          profit_trigger_percent: profitTriggerPercent,
          giveback_allowed_percent: givebackAllowedPercent,
          hard_floor_percent: hardFloorPercent,
          token_volatility_at_entry: volatility,
        })
        .eq('id', id)

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to activate limit order' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        status: 'waiting_entry',
        targetPrice: plan.target_entry_price,
        thresholdPercent: plan.entry_threshold_percent,
        maxWaitHours: plan.max_wait_hours,
        volatility,
        profitProtection: {
          enabled: profitProtectionEnabled,
          triggerPercent: profitTriggerPercent,
          givebackAllowedPercent,
          hardFloorPercent,
        },
        message: `Limit order activated. Will buy when price reaches $${plan.target_entry_price.toFixed(8)} (±${plan.entry_threshold_percent}%)`,
      })
    }

    // Market buy - execute immediately

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

    // Get the actual token market price using Jupiter Price API
    // This returns the human-readable price (not per smallest unit)
    const entryPriceUsd = await jupiter.getTokenPrice(plan.token_mint)
    const tokensReceived = parseInt(result.outputAmountResult || quote.outAmount)

    console.log('Trade executed:', {
      tokensReceived,
      inUsdValue: quote.inUsdValue,
      outUsdValue: quote.outUsdValue,
      entryPriceUsd,
      stopLossPrice: entryPriceUsd * (1 - plan.stop_loss_percent / 100),
      takeProfitPrice: entryPriceUsd * (1 + plan.take_profit_percent / 100),
    })

    // Update plan to active with profit protection settings
    const { error: updateError } = await supabase
      .from('trading_plans')
      .update({
        status: 'active',
        amount_tokens: tokensReceived,
        entry_price_usd: entryPriceUsd,
        stop_loss_price: entryPriceUsd * (1 - plan.stop_loss_percent / 100),
        take_profit_price: entryPriceUsd * (1 + plan.take_profit_percent / 100),
        entry_tx_signature: result.signature,
        // Profit protection settings
        profit_protection_enabled: profitProtectionEnabled,
        profit_trigger_percent: profitTriggerPercent,
        giveback_allowed_percent: givebackAllowedPercent,
        hard_floor_percent: hardFloorPercent,
        token_volatility_at_entry: volatility,
        peak_profit_percent: 0, // Initialize peak tracking
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

    // Send entry notification email
    try {
      const stopLossPrice = entryPriceUsd * (1 - plan.stop_loss_percent / 100)
      const takeProfitPrice = entryPriceUsd * (1 + plan.take_profit_percent / 100)

      await sendTradeEntryEmail({
        to: user.email!,
        tokenSymbol: plan.token_symbol || 'Unknown',
        tokenMint: plan.token_mint,
        amountSol: plan.amount_sol,
        tokensReceived,
        entryPriceUsd,
        stopLossPercent: plan.stop_loss_percent,
        takeProfitPercent: plan.take_profit_percent,
        stopLossPrice,
        takeProfitPrice,
        txSignature: result.signature,
        isLimitOrder: false,
      })
    } catch (emailErr) {
      console.error('Failed to send entry email:', emailErr)
      // Don't fail the request if email fails
    }

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
