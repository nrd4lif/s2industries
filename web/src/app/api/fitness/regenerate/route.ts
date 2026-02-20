import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { generatePlan, getTodayInChicago, parseDateString } from '@/lib/fitness/plan-generator'

// POST /api/fitness/regenerate - Delete future workouts and regenerate from templates
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const body = await request.json()

    const days = body.days || 30
    const today = getTodayInChicago()

    // Get user settings
    const { data: settings } = await supabase
      .from('user_fitness_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Delete all future workout days (not completed ones)
    const { error: deleteError } = await supabase
      .from('workout_days')
      .delete()
      .eq('user_id', user.id)
      .gte('workout_date', today)
      .is('completed_at', null)

    if (deleteError) {
      console.error('Error deleting workout days:', deleteError)
      return NextResponse.json({ error: 'Failed to delete existing workouts' }, { status: 500 })
    }

    // Generate new plan from templates
    const startDate = parseDateString(today)
    const plan = generatePlan(startDate, days, settings || {})

    // Insert new days
    const toInsert = plan.map(d => ({
      user_id: user.id,
      workout_date: d.workout_date,
      workout_type: d.workout_type,
      planned_json: d.planned_json,
      week_number: d.week_number,
      ai_generated: false,
    }))

    const { error: insertError } = await supabase
      .from('workout_days')
      .upsert(toInsert, {
        onConflict: 'user_id,workout_date',
        ignoreDuplicates: false,
      })

    if (insertError) {
      console.error('Error inserting workout days:', insertError)
      return NextResponse.json({ error: 'Failed to generate workout plan' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Regenerated ${plan.length} workout days`,
      days_created: plan.length,
    })
  } catch (error) {
    console.error('Regenerate error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to regenerate workouts',
    }, { status: 500 })
  }
}
