import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { analyzeWorkoutsAndGeneratePlan, HealthProfile } from '@/lib/fitness/ai-analyzer'
import { WorkoutDay } from '@/types/fitness'
import { getTodayInChicago } from '@/lib/fitness/plan-generator'

// Create a service role client for cron jobs (bypasses RLS)
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/cron/fitness-planner - Runs daily to extend workout plans
// Vercel Cron: Add to vercel.json: { "crons": [{ "path": "/api/cron/fitness-planner", "schedule": "0 6 * * *" }] }
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
      .select('user_id, health_considerations, fitness_goals, experience_level')

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

        // Get past workout data for analysis
        const pastDate = new Date(today)
        pastDate.setDate(pastDate.getDate() - 30)
        const pastDateStr = pastDate.toISOString().split('T')[0]

        const { data: workouts, error: workoutsError } = await supabase
          .from('workout_days')
          .select('*')
          .eq('user_id', userSettings.user_id)
          .gte('workout_date', pastDateStr)
          .lte('workout_date', today)
          .order('workout_date', { ascending: true })

        if (workoutsError) {
          errors.push(`User ${userSettings.user_id}: ${workoutsError.message}`)
          continue
        }

        // If no workout history, skip AI analysis (user should trigger manually)
        if (!workouts || workouts.length < 3) {
          continue
        }

        const healthProfile: HealthProfile = {
          health_considerations: userSettings.health_considerations || 'Chronic back problems',
          fitness_goals: userSettings.fitness_goals || 'General fitness',
          experience_level: userSettings.experience_level || 'beginner',
        }

        // Run AI analysis
        const analysis = await analyzeWorkoutsAndGeneratePlan(
          workouts as WorkoutDay[],
          healthProfile,
          7 // Generate 7 days
        )

        // Store analysis
        await supabase
          .from('fitness_ai_analyses')
          .insert({
            user_id: userSettings.user_id,
            workouts_analyzed: workouts.length,
            date_range_start: pastDateStr,
            date_range_end: today,
            performance_summary: analysis.performance_summary,
            recommendations: analysis.recommendations,
            days_generated: analysis.next_week_plan.length,
            raw_response: JSON.stringify(analysis),
          })

        // Insert generated workout days
        if (analysis.next_week_plan && analysis.next_week_plan.length > 0) {
          const tomorrow = new Date(today)
          tomorrow.setDate(tomorrow.getDate() + 1)

          const newDays = analysis.next_week_plan.map(day => {
            const workoutDate = new Date(tomorrow)
            workoutDate.setDate(workoutDate.getDate() + day.day_offset)
            const dateStr = workoutDate.toISOString().split('T')[0]

            return {
              user_id: userSettings.user_id,
              workout_date: dateStr,
              workout_type: day.workout_type,
              planned_json: day.planned_json,
              ai_generated: true,
              ai_notes: day.ai_notes,
              week_number: Math.ceil((day.day_offset + 1) / 7),
            }
          })

          for (const day of newDays) {
            await supabase
              .from('workout_days')
              .upsert(day, { onConflict: 'user_id,workout_date' })
          }
        }

        // Update settings
        await supabase
          .from('user_fitness_settings')
          .update({
            last_ai_analysis_at: new Date().toISOString(),
            ai_recommendations: analysis.recommendations,
          })
          .eq('user_id', userSettings.user_id)

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
