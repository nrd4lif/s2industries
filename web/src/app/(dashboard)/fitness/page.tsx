import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { generatePlan, getTodayInChicago, parseDateString } from '@/lib/fitness/plan-generator'
import { WorkoutDay } from '@/types/fitness'
import TodayCard from './components/TodayCard'
import ThirtyDayView from './components/ThirtyDayView'

async function getWorkoutDays(userId: string): Promise<WorkoutDay[]> {
  const supabase = await createClient()
  const today = getTodayInChicago()
  const startDate = parseDateString(today)

  // Get end date (today + 29 days = 30 days total)
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 29)
  const endDateStr = endDate.toISOString().split('T')[0]

  // Fetch existing days
  const { data: existingDays, error } = await supabase
    .from('workout_days')
    .select('*')
    .eq('user_id', userId)
    .gte('workout_date', today)
    .lte('workout_date', endDateStr)
    .order('workout_date', { ascending: true })

  if (error) {
    console.error('Error fetching workout days:', error)
    return []
  }

  // Check if we need to generate missing days
  const existingDates = new Set((existingDays || []).map(d => d.workout_date))
  const totalDays = 30

  // If we have all the days, return them
  if (existingDays && existingDays.length >= totalDays) {
    return existingDays as WorkoutDay[]
  }

  // Get user settings for plan generation
  const { data: settings } = await supabase
    .from('user_fitness_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  // Generate plan for missing days
  const generatedPlan = generatePlan(startDate, totalDays, settings || {})
  const missingDays = generatedPlan.filter(d => !existingDates.has(d.workout_date))

  if (missingDays.length > 0) {
    // Insert missing days
    const toInsert = missingDays.map(d => ({
      user_id: userId,
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
    }

    // Re-fetch all days
    const { data: allDays } = await supabase
      .from('workout_days')
      .select('*')
      .eq('user_id', userId)
      .gte('workout_date', today)
      .lte('workout_date', endDateStr)
      .order('workout_date', { ascending: true })

    return (allDays || []) as WorkoutDay[]
  }

  return (existingDays || []) as WorkoutDay[]
}

export default async function FitnessPage() {
  const user = await requireAuth()
  const days = await getWorkoutDays(user.id)
  const today = getTodayInChicago()
  const todayWorkout = days.find(d => d.workout_date === today)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Fitness</h1>
      </div>

      {/* Today's Workout Card */}
      {todayWorkout && (
        <TodayCard workout={todayWorkout} />
      )}

      {/* 30-Day Outlook */}
      <ThirtyDayView days={days} today={today} />
    </div>
  )
}
