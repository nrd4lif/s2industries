import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

const editPlanSchema = z.object({
  amount_sol: z.number().positive().max(1000).optional(),
  stop_loss_percent: z.number().min(1).max(90).optional(),
  take_profit_percent: z.number().min(1).max(500).optional(),
  target_entry_price: z.number().positive().optional(),
  entry_threshold_percent: z.number().min(0.1).max(10).optional(),
  max_wait_hours: z.number().min(1).max(168).optional(),
  // Advanced features
  use_trailing_stop: z.boolean().optional(),
  trailing_stop_percent: z.number().min(1).max(90).optional(),
  use_breakeven_stop: z.boolean().optional(),
  breakeven_trigger_percent: z.number().min(1).max(50).optional(),
  max_hold_hours: z.number().min(1).max(720).nullable().optional(),
  // Profit protection
  profit_protection_enabled: z.boolean().optional(),
  profit_trigger_percent: z.number().min(1).max(100).optional(),
  giveback_allowed_percent: z.number().min(0.5).max(50).optional(),
  hard_floor_percent: z.number().min(0.5).max(50).optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const user = await requireAuth()
    const supabase = await createClient()
    const body = await request.json()

    const input = editPlanSchema.parse(body)

    // Get the plan - allow editing pending, waiting_entry, AND active plans
    const { data: plan, error: planError } = await supabase
      .from('trading_plans')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .in('status', ['pending', 'waiting_entry', 'active'])
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found or cannot be edited' },
        { status: 404 }
      )
    }

    const isActive = plan.status === 'active'

    // Build update object
    const updates: Record<string, unknown> = {}

    // For active plans, only allow editing exit parameters (not entry/amount)
    if (!isActive && input.amount_sol !== undefined) {
      updates.amount_sol = input.amount_sol
    }

    if (input.stop_loss_percent !== undefined) {
      updates.stop_loss_percent = input.stop_loss_percent
    }

    if (input.take_profit_percent !== undefined) {
      updates.take_profit_percent = input.take_profit_percent
    }

    // Only allow editing entry params for non-active plans
    if (!isActive) {
      if (input.target_entry_price !== undefined) {
        updates.target_entry_price = input.target_entry_price
      }
      if (input.entry_threshold_percent !== undefined) {
        updates.entry_threshold_percent = input.entry_threshold_percent
      }
      if (input.max_wait_hours !== undefined) {
        updates.max_wait_hours = input.max_wait_hours
      }
    }

    // Advanced features can be edited on any editable plan
    if (input.use_trailing_stop !== undefined) {
      updates.use_trailing_stop = input.use_trailing_stop
    }
    if (input.trailing_stop_percent !== undefined) {
      updates.trailing_stop_percent = input.trailing_stop_percent
    }
    if (input.use_breakeven_stop !== undefined) {
      updates.use_breakeven_stop = input.use_breakeven_stop
    }
    if (input.breakeven_trigger_percent !== undefined) {
      updates.breakeven_trigger_percent = input.breakeven_trigger_percent
    }
    if (input.max_hold_hours !== undefined) {
      updates.max_hold_hours = input.max_hold_hours
    }

    // Profit protection settings (can be edited on any plan status)
    if (input.profit_protection_enabled !== undefined) {
      updates.profit_protection_enabled = input.profit_protection_enabled
    }
    if (input.profit_trigger_percent !== undefined) {
      updates.profit_trigger_percent = input.profit_trigger_percent
    }
    if (input.giveback_allowed_percent !== undefined) {
      updates.giveback_allowed_percent = input.giveback_allowed_percent
    }
    if (input.hard_floor_percent !== undefined) {
      updates.hard_floor_percent = input.hard_floor_percent
    }

    // Recalculate stop loss and take profit prices
    const entryPrice = isActive
      ? plan.entry_price_usd  // Use actual entry price for active trades
      : (input.target_entry_price ?? plan.target_entry_price ?? plan.entry_price_usd)

    const stopLossPercent = input.stop_loss_percent ?? plan.stop_loss_percent
    const takeProfitPercent = input.take_profit_percent ?? plan.take_profit_percent

    if (entryPrice) {
      if (input.stop_loss_percent !== undefined) {
        updates.stop_loss_price = entryPrice * (1 - stopLossPercent / 100)
      }
      if (input.take_profit_percent !== undefined) {
        updates.take_profit_price = entryPrice * (1 + takeProfitPercent / 100)
      }
    }

    // Update trailing stop price if trailing stop settings changed
    if (isActive && (input.use_trailing_stop !== undefined || input.trailing_stop_percent !== undefined)) {
      const useTrailing = input.use_trailing_stop ?? plan.use_trailing_stop
      const trailingPercent = input.trailing_stop_percent ?? plan.trailing_stop_percent ?? stopLossPercent
      const highestPrice = plan.highest_price_since_entry || entryPrice

      if (useTrailing && highestPrice) {
        updates.trailing_stop_price = highestPrice * (1 - trailingPercent / 100)
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Update the plan
    const { data: updatedPlan, error: updateError } = await supabase
      .from('trading_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update plan:', updateError)
      return NextResponse.json(
        { error: 'Failed to update plan' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      plan: updatedPlan,
      message: isActive
        ? 'Active trade updated. New SL/TP will be used on next price check.'
        : 'Plan updated successfully.',
    })
  } catch (err) {
    console.error('Edit plan error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to edit plan' },
      { status: 400 }
    )
  }
}
