import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { generatePlan, getTodayInChicago, parseDateString } from '@/lib/fitness/plan-generator'

// GET /api/fitness/days - Fetch workout days for a date range
// Query params: start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)
// If no params, returns today + next 29 days
export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const today = getTodayInChicago()
    const startDate = searchParams.get('start_date') || today

    // Default end date is 30 days from start
    const defaultEndDate = new Date(parseDateString(startDate))
    defaultEndDate.setDate(defaultEndDate.getDate() + 29)
    const endDate = searchParams.get('end_date') || defaultEndDate.toISOString().split('T')[0]

    // Fetch existing days
    const { data: existingDays, error } = await supabase
      .from('workout_days')
      .select('*')
      .eq('user_id', user.id)
      .gte('workout_date', startDate)
      .lte('workout_date', endDate)
      .order('workout_date', { ascending: true })

    if (error) {
      console.error('Error fetching workout days:', error)
      return NextResponse.json({ error: 'Failed to fetch workout days' }, { status: 500 })
    }

    // Check if we need to generate missing days
    const existingDates = new Set((existingDays || []).map(d => d.workout_date))
    const start = parseDateString(startDate)
    const end = parseDateString(endDate)
    const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // If we have all the days, return them
    if (existingDays && existingDays.length === totalDays) {
      return NextResponse.json({ days: existingDays })
    }

    // Get user settings for plan generation
    const { data: settings } = await supabase
      .from('user_fitness_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Generate plan for missing days
    const generatedPlan = generatePlan(start, totalDays, settings || {})
    const missingDays = generatedPlan.filter(d => !existingDates.has(d.workout_date))

    if (missingDays.length > 0) {
      // Insert missing days
      const toInsert = missingDays.map(d => ({
        user_id: user.id,
        workout_date: d.workout_date,
        workout_type: d.workout_type,
        planned_json: d.planned_json,
        week_number: d.week_number,
      }))

      const { error: insertError } = await supabase
        .from('workout_days')
        .insert(toInsert)

      if (insertError) {
        console.error('Error inserting workout days:', insertError)
        return NextResponse.json({ error: 'Failed to generate workout plan' }, { status: 500 })
      }

      // Re-fetch all days
      const { data: allDays, error: refetchError } = await supabase
        .from('workout_days')
        .select('*')
        .eq('user_id', user.id)
        .gte('workout_date', startDate)
        .lte('workout_date', endDate)
        .order('workout_date', { ascending: true })

      if (refetchError) {
        return NextResponse.json({ error: 'Failed to fetch workout days' }, { status: 500 })
      }

      return NextResponse.json({ days: allDays, generated: missingDays.length })
    }

    return NextResponse.json({ days: existingDays || [] })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
