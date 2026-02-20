import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generatePlan, getTodayInChicago, parseDateString } from '@/lib/fitness/plan-generator'

// Create a service role client for cron jobs (bypasses RLS)
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/cron/fitness-planner - Runs daily to extend workout plans using templates
// Vercel Cron: { "path": "/api/cron/fitness-planner", "schedule": "0 6 * * *" }
export async function GET(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const today = getTodayInChicago()

    // Find users who need plan extension (less than 7 future days)
    const futureDate = new Date(today)
    futureDate.setDate(futureDate.getDate() + 7)
    const futureDateStr = futureDate.toISOString().split('T')[0]

    // Get all users with fitness settings
    const { data: users, error: usersError } = await supabase
      .from('user_fitness_settings')
      .select('user_id')

    if (usersError) {
      console.error('Error fetching users:', usersError)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ message: 'No users to process', processed: 0 })
    }

    let processed = 0
    const errors: string[] = []

    for (const userSettings of users) {
      try {
        // Check how many future days this user has
        const { count, error: countError } = await supabase
          .from('workout_days')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userSettings.user_id)
          .gt('workout_date', today)
          .lte('workout_date', futureDateStr)

        if (countError) {
          errors.push(`User ${userSettings.user_id}: ${countError.message}`)
          continue
        }

        // If user has 7+ future days, skip
        if (count && count >= 7) {
          continue
        }

        // Get user's full settings for plan generation
        const { data: settings } = await supabase
          .from('user_fitness_settings')
          .select('*')
          .eq('user_id', userSettings.user_id)
          .single()

        // Find the last workout date to continue from
        const { data: lastDay } = await supabase
          .from('workout_days')
          .select('workout_date')
          .eq('user_id', userSettings.user_id)
          .order('workout_date', { ascending: false })
          .limit(1)
          .single()

        // Start from tomorrow or the day after last workout
        let startDate: Date
        if (lastDay) {
          startDate = parseDateString(lastDay.workout_date)
          startDate.setDate(startDate.getDate() + 1)
        } else {
          startDate = parseDateString(today)
        }

        // Generate 14 days using templates
        const plan = generatePlan(startDate, 14, settings || {})

        // Filter out days that already exist
        const { data: existingDays } = await supabase
          .from('workout_days')
          .select('workout_date')
          .eq('user_id', userSettings.user_id)
          .in('workout_date', plan.map(p => p.workout_date))

        const existingDates = new Set((existingDays || []).map(d => d.workout_date))
        const newDays = plan.filter(d => !existingDates.has(d.workout_date))

        if (newDays.length === 0) {
          continue
        }

        // Insert new days
        const toInsert = newDays.map(d => ({
          user_id: userSettings.user_id,
          workout_date: d.workout_date,
          workout_type: d.workout_type,
          planned_json: d.planned_json,
          week_number: d.week_number,
          ai_generated: false,
        }))

        const { error: insertError } = await supabase
          .from('workout_days')
          .insert(toInsert)

        if (insertError) {
          errors.push(`User ${userSettings.user_id}: ${insertError.message}`)
          continue
        }

        processed++
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`User ${userSettings.user_id}: ${msg}`)
      }
    }

    return NextResponse.json({
      message: `Processed ${processed} users`,
      processed,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Cron job failed',
    }, { status: 500 })
  }
}
