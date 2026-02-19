import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { analyzeWorkoutsAndGeneratePlan, HealthProfile } from '@/lib/fitness/ai-analyzer'
import { WorkoutDay } from '@/types/fitness'
import { getTodayInChicago } from '@/lib/fitness/plan-generator'

// POST /api/fitness/analyze - Run AI analysis on workout history and generate new plan
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()
    const body = await request.json()

    const daysToAnalyze = body.days_to_analyze || 30
    const daysToGenerate = body.days_to_generate || 7

    // Get user's health profile
    const { data: settings } = await supabase
      .from('user_fitness_settings')
      .select('health_considerations, fitness_goals, experience_level')
      .eq('user_id', user.id)
      .single()

    const healthProfile: HealthProfile = {
      health_considerations: settings?.health_considerations || 'Chronic back problems - avoid exercises that strain the lower back',
      fitness_goals: settings?.fitness_goals || 'Build strength safely while protecting back',
      experience_level: settings?.experience_level || 'beginner',
    }

    // Get past workout data
    const today = getTodayInChicago()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - daysToAnalyze)
    const startDateStr = startDate.toISOString().split('T')[0]

    const { data: workouts, error: workoutsError } = await supabase
      .from('workout_days')
      .select('*')
      .eq('user_id', user.id)
      .gte('workout_date', startDateStr)
      .lte('workout_date', today)
      .order('workout_date', { ascending: true })

    if (workoutsError) {
      console.error('Error fetching workouts:', workoutsError)
      return NextResponse.json({ error: 'Failed to fetch workout history' }, { status: 500 })
    }

    if (!workouts || workouts.length === 0) {
      return NextResponse.json({
        error: 'No workout history found. Complete some workouts first.',
      }, { status: 400 })
    }

    // Run AI analysis
    const analysis = await analyzeWorkoutsAndGeneratePlan(
      workouts as WorkoutDay[],
      healthProfile,
      daysToGenerate
    )

    // Store the analysis
    const { error: analysisError } = await supabase
      .from('fitness_ai_analyses')
      .insert({
        user_id: user.id,
        workouts_analyzed: workouts.length,
        date_range_start: startDateStr,
        date_range_end: today,
        performance_summary: analysis.performance_summary,
        recommendations: analysis.recommendations,
        days_generated: analysis.next_week_plan.length,
        raw_response: JSON.stringify(analysis),
      })

    if (analysisError) {
      console.error('Error storing analysis:', analysisError)
      // Continue anyway - the analysis was successful
    }

    // Generate workout days from the plan
    if (analysis.next_week_plan && analysis.next_week_plan.length > 0) {
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const newDays = analysis.next_week_plan.map(day => {
        const workoutDate = new Date(tomorrow)
        workoutDate.setDate(workoutDate.getDate() + day.day_offset)
        const dateStr = workoutDate.toISOString().split('T')[0]

        return {
          user_id: user.id,
          workout_date: dateStr,
          workout_type: day.workout_type,
          planned_json: day.planned_json,
          ai_generated: true,
          ai_notes: day.ai_notes,
          week_number: Math.ceil((day.day_offset + 1) / 7),
        }
      })

      // Upsert the new days (update if exists, insert if not)
      for (const day of newDays) {
        const { error: upsertError } = await supabase
          .from('workout_days')
          .upsert(day, {
            onConflict: 'user_id,workout_date',
          })

        if (upsertError) {
          console.error('Error upserting workout day:', upsertError)
        }
      }
    }

    // Update last analysis timestamp
    await supabase
      .from('user_fitness_settings')
      .upsert({
        user_id: user.id,
        last_ai_analysis_at: new Date().toISOString(),
        ai_recommendations: analysis.recommendations,
      }, {
        onConflict: 'user_id',
      })

    return NextResponse.json({
      success: true,
      analysis: {
        performance_summary: analysis.performance_summary,
        recommendations: analysis.recommendations,
        days_generated: analysis.next_week_plan.length,
      },
    })
  } catch (error) {
    console.error('AI analysis error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to analyze workouts',
    }, { status: 500 })
  }
}

// GET /api/fitness/analyze - Get the most recent AI analysis
export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { data: analysis, error } = await supabase
      .from('fitness_ai_analyses')
      .select('*')
      .eq('user_id', user.id)
      .order('analysis_date', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching analysis:', error)
      return NextResponse.json({ error: 'Failed to fetch analysis' }, { status: 500 })
    }

    return NextResponse.json({ analysis: analysis || null })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
