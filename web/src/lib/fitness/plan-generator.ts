import {
  WorkoutType,
  CardioPlanned,
  StrengthPlanned,
  RestPlanned,
  ExercisePlanned,
  UserFitnessSettings,
} from '@/types/fitness'

// Default settings if user has none
const DEFAULT_SETTINGS: Partial<UserFitnessSettings> = {
  default_treadmill_speed: 3.0,
  default_warmup_minutes: 5,
  default_cooldown_minutes: 5,
  starting_incline: 4,
  bench_weight: 45,
  row_weight: 45,
  overhead_press_weight: 25,
  lat_pulldown_weight: 70,
  curl_weight: 15,
  tricep_weight: 15,
  squat_weight: 95,
  rdl_weight: 65,
  lunge_weight: 20,
  hamstring_curl_weight: 50,
  calf_raise_weight: 100,
}

// Weekly schedule pattern (0 = Sunday)
// Mon(1): Upper, Tue(2): Cardio, Wed(3): Lower, Thu(4): Cardio, Fri(5): Upper, Sat(6): Optional, Sun(0): Rest
export function getWorkoutTypeForDay(dayOfWeek: number, weekNumber: number): WorkoutType {
  switch (dayOfWeek) {
    case 0: return 'REST'  // Sunday
    case 1: return 'UPPER'  // Monday
    case 2: return 'CARDIO' // Tuesday
    case 3: return 'LOWER'  // Wednesday
    case 4: return 'CARDIO' // Thursday
    case 5: return 'UPPER'  // Friday
    case 6: // Saturday - alternates
      return weekNumber % 2 === 1 ? 'CARDIO' : 'RECOVERY'
    default: return 'REST'
  }
}

// Calculate week number (1-4+) from start date
export function getWeekNumber(startDate: Date, currentDate: Date): number {
  const diffTime = currentDate.getTime() - startDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return Math.floor(diffDays / 7) + 1
}

// Generate cardio plan based on week number
export function generateCardioPlan(
  weekNumber: number,
  settings: Partial<UserFitnessSettings>
): CardioPlanned {
  const s = { ...DEFAULT_SETTINGS, ...settings }
  const speed = s.default_treadmill_speed!

  // Base values for week 1
  let mainDuration = 20
  let mainIncline = s.starting_incline!

  // Progressive overload by week
  // Week 2: +2 minutes duration (22)
  // Week 3: +1% incline (5%)
  // Week 4: +2 minutes duration (24)
  // Pattern continues: alternate duration/incline increases
  if (weekNumber >= 2) {
    // Weeks 2, 4, 6, 8... add duration
    const durationBumps = Math.floor(weekNumber / 2)
    mainDuration = 20 + (durationBumps * 2)
  }
  if (weekNumber >= 3) {
    // Weeks 3, 5, 7, 9... add incline
    const inclineBumps = Math.floor((weekNumber - 1) / 2)
    mainIncline = Math.min(s.starting_incline! + inclineBumps, 8) // Cap at 8% for first 30 days
  }

  return {
    warmup: {
      incline: 0,
      speed,
      duration: s.default_warmup_minutes!,
    },
    main: {
      incline: mainIncline,
      speed,
      duration: mainDuration,
    },
    cooldown: {
      incline: 0,
      speed,
      duration: s.default_cooldown_minutes!,
    },
  }
}

// Upper body exercises template
export function generateUpperPlan(
  weekNumber: number,
  settings: Partial<UserFitnessSettings>
): StrengthPlanned {
  const s = { ...DEFAULT_SETTINGS, ...settings }

  // Calculate weights with progression
  // Big lifts: +5lbs per week (after week 1)
  // Small lifts: +2.5lbs per week (after week 1)
  const weekOffset = Math.max(0, weekNumber - 1)
  const bigLiftIncrease = weekOffset * 5
  const smallLiftIncrease = weekOffset * 2.5

  const exercises: ExercisePlanned[] = [
    {
      name: 'Dumbbell or Barbell Bench Press',
      sets: 3,
      reps_min: 6,
      reps_max: 8,
      weight: s.bench_weight! + bigLiftIncrease,
      exercise_category: 'big',
    },
    {
      name: 'Seated Cable Row',
      sets: 3,
      reps_min: 8,
      reps_max: 10,
      weight: s.row_weight! + bigLiftIncrease,
      exercise_category: 'big',
    },
    {
      name: 'Overhead Press',
      sets: 3,
      reps_min: 6,
      reps_max: 8,
      weight: s.overhead_press_weight! + bigLiftIncrease,
      exercise_category: 'big',
    },
    {
      name: 'Lat Pulldown',
      sets: 3,
      reps_min: 8,
      reps_max: 10,
      weight: s.lat_pulldown_weight! + bigLiftIncrease,
      exercise_category: 'big',
    },
    {
      name: 'Bicep Curls',
      sets: 2,
      reps_min: 10,
      reps_max: 12,
      weight: s.curl_weight! + smallLiftIncrease,
      is_optional: true,
      exercise_category: 'small',
    },
    {
      name: 'Tricep Pushdowns',
      sets: 2,
      reps_min: 10,
      reps_max: 12,
      weight: s.tricep_weight! + smallLiftIncrease,
      is_optional: true,
      exercise_category: 'small',
    },
  ]

  return { exercises }
}

// Lower body exercises template
export function generateLowerPlan(
  weekNumber: number,
  settings: Partial<UserFitnessSettings>
): StrengthPlanned {
  const s = { ...DEFAULT_SETTINGS, ...settings }

  const weekOffset = Math.max(0, weekNumber - 1)
  const bigLiftIncrease = weekOffset * 5
  const smallLiftIncrease = weekOffset * 2.5

  const exercises: ExercisePlanned[] = [
    {
      name: 'Squat or Leg Press',
      sets: 3,
      reps_min: 6,
      reps_max: 8,
      weight: s.squat_weight! + bigLiftIncrease,
      exercise_category: 'big',
    },
    {
      name: 'Romanian Deadlift',
      sets: 3,
      reps_min: 8,
      reps_max: 8,
      weight: s.rdl_weight! + bigLiftIncrease,
      exercise_category: 'big',
    },
    {
      name: 'Walking Lunges',
      sets: 2,
      reps_min: 10,
      reps_max: 10,
      weight: s.lunge_weight! + smallLiftIncrease,
      notes: '10 each leg',
      exercise_category: 'small',
    },
    {
      name: 'Lying Hamstring Curl',
      sets: 3,
      reps_min: 10,
      reps_max: 10,
      weight: s.hamstring_curl_weight! + bigLiftIncrease,
      exercise_category: 'big',
    },
    {
      name: 'Seated Calf Raise',
      sets: 3,
      reps_min: 12,
      reps_max: 12,
      weight: s.calf_raise_weight! + smallLiftIncrease,
      exercise_category: 'small',
    },
  ]

  return { exercises }
}

// Recovery day plan
export function generateRecoveryPlan(): RestPlanned {
  return {
    notes: 'Optional recovery activities',
    suggested_activity: 'Light stretching, foam rolling, or a gentle walk',
  }
}

// Rest day plan
export function generateRestPlan(): RestPlanned {
  return {
    notes: 'Full rest day - let your body recover',
  }
}

// Main plan generator
export interface GeneratedDay {
  workout_date: string
  workout_type: WorkoutType
  planned_json: CardioPlanned | StrengthPlanned | RestPlanned | null
  week_number: number
}

export function generatePlan(
  startDate: Date,
  days: number,
  settings: Partial<UserFitnessSettings>
): GeneratedDay[] {
  const plan: GeneratedDay[] = []

  for (let i = 0; i < days; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(startDate.getDate() + i)

    const dayOfWeek = currentDate.getDay()
    const weekNumber = getWeekNumber(startDate, currentDate)
    const workoutType = getWorkoutTypeForDay(dayOfWeek, weekNumber)

    let planned_json: CardioPlanned | StrengthPlanned | RestPlanned | null = null

    switch (workoutType) {
      case 'CARDIO':
        planned_json = generateCardioPlan(weekNumber, settings)
        break
      case 'UPPER':
        planned_json = generateUpperPlan(weekNumber, settings)
        break
      case 'LOWER':
        planned_json = generateLowerPlan(weekNumber, settings)
        break
      case 'RECOVERY':
        planned_json = generateRecoveryPlan()
        break
      case 'REST':
        planned_json = generateRestPlan()
        break
    }

    // Format date as YYYY-MM-DD
    const workout_date = currentDate.toISOString().split('T')[0]

    plan.push({
      workout_date,
      workout_type: workoutType,
      planned_json,
      week_number: weekNumber,
    })
  }

  return plan
}

// Get today's date in America/Chicago timezone formatted as YYYY-MM-DD
export function getTodayInChicago(): string {
  const now = new Date()
  const chicagoTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }))
  return chicagoTime.toISOString().split('T')[0]
}

// Parse a date string in YYYY-MM-DD format to a Date object (treating as local date)
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}
