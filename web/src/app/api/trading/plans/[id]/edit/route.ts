import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

const editPlanSchema = z.object({
  amount_sol: z.number().positive().max(1000).optional(),
  stop_loss_percent: z.number().min(1).max(50).optional(),
  take_profit_percent: z.number().min(1).max(500).optional(),
  target_entry_price: z.number().positive().optional(),
  entry_threshold_percent: z.number().min(0.1).max(10).optional(),
  max_wait_hours: z.number().min(1).max(168).optional(),
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

    // Get the plan (must be in pending or waiting_entry status)
    const { data: plan, error: planError } = await supabase
      .from('trading_plans')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .in('status', ['pending', 'waiting_entry'])
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found or cannot be edited (only pending/waiting orders can be edited)' },
        { status: 404 }
      )
    }

    // Build update object
    const updates: Record<string, unknown> = {}

    if (input.amount_sol !== undefined) {
      updates.amount_sol = input.amount_sol
    }

    if (input.stop_loss_percent !== undefined) {
      updates.stop_loss_percent = input.stop_loss_percent
    }

    if (input.take_profit_percent !== undefined) {
      updates.take_profit_percent = input.take_profit_percent
    }

    if (input.target_entry_price !== undefined) {
      updates.target_entry_price = input.target_entry_price
    }

    if (input.entry_threshold_percent !== undefined) {
      updates.entry_threshold_percent = input.entry_threshold_percent
    }

    if (input.max_wait_hours !== undefined) {
      updates.max_wait_hours = input.max_wait_hours
    }

    // Recalculate stop loss and take profit prices if relevant fields changed
    const entryPrice = input.target_entry_price ?? plan.target_entry_price ?? plan.entry_price_usd
    const stopLossPercent = input.stop_loss_percent ?? plan.stop_loss_percent
    const takeProfitPercent = input.take_profit_percent ?? plan.take_profit_percent

    if (entryPrice) {
      updates.stop_loss_price = entryPrice * (1 - stopLossPercent / 100)
      updates.take_profit_price = entryPrice * (1 + takeProfitPercent / 100)
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

    return NextResponse.json({ plan: updatedPlan })
  } catch (err) {
    console.error('Edit plan error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to edit plan' },
      { status: 400 }
    )
  }
}
