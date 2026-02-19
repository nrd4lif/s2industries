// Workout Types
export type WorkoutType = 'REST' | 'CARDIO' | 'UPPER' | 'LOWER' | 'RECOVERY'

// Cardio session structure
export interface CardioSegment {
  incline: number      // Percent (0-15)
  speed: number        // MPH
  duration: number     // Minutes
}

export interface CardioPlanned {
  warmup: CardioSegment
  main: CardioSegment
  cooldown: CardioSegment
}

export interface CardioActual extends CardioPlanned {
  // Same structure as planned, but with actual values performed
}

// Strength exercise structure
export interface ExercisePlanned {
  name: string
  sets: number
  reps_min: number     // e.g., 6 for "6-8 reps"
  reps_max: number     // e.g., 8 for "6-8 reps"
  weight: number | null  // lbs, null if bodyweight
  notes?: string
  is_optional?: boolean
  exercise_category: 'big' | 'small'  // For progression: big lifts +5lbs, small +2.5lbs
}

export interface SetActual {
  reps: number
  weight: number | null
}

export interface ExerciseActual extends ExercisePlanned {
  sets_completed: SetActual[]  // Array of actual sets performed
}

export interface StrengthPlanned {
  exercises: ExercisePlanned[]
}

export interface StrengthActual {
  exercises: ExerciseActual[]
}

// Recovery/Rest structure
export interface RestPlanned {
  notes?: string
  suggested_activity?: string  // e.g., "Light stretching", "Foam rolling"
}

// Combined planned workout type
export type PlannedWorkout = CardioPlanned | StrengthPlanned | RestPlanned | null

// Combined actual workout type
export type ActualWorkout = CardioActual | StrengthActual | RestPlanned | null

// Database row for workout_days
export interface WorkoutDay {
  id: string
  user_id: string
  workout_date: string  // YYYY-MM-DD format
  workout_type: WorkoutType
  planned_json: PlannedWorkout
  actual_json: ActualWorkout
  completed_at: string | null
  notes: string | null
  week_number: number
  ai_generated: boolean
  ai_notes: string | null
  created_at: string
  updated_at: string
}

// User fitness settings
export interface UserFitnessSettings {
  id: string
  user_id: string
  default_treadmill_speed: number
  default_warmup_minutes: number
  default_cooldown_minutes: number
  starting_incline: number
  progression_type: 'automatic' | 'manual'
  prefer_rep_increase: boolean
  bench_weight: number
  row_weight: number
  overhead_press_weight: number
  lat_pulldown_weight: number
  curl_weight: number
  tricep_weight: number
  squat_weight: number
  rdl_weight: number
  lunge_weight: number
  hamstring_curl_weight: number
  calf_raise_weight: number
  timezone: string
  // Health and AI fields
  health_considerations: string | null
  fitness_goals: string | null
  experience_level: string
  last_ai_analysis_at: string | null
  ai_recommendations: AIRecommendations | null
  created_at: string
  updated_at: string
}

// AI Recommendations structure
export interface AIRecommendations {
  exercises_to_modify: Array<{
    exercise_name: string
    current_weight: number | null
    suggested_weight: number | null
    current_sets: number
    suggested_sets: number
    current_reps: string
    suggested_reps: string
    reason: string
  }>
  exercises_to_add: Array<{
    name: string
    sets: number
    reps_min: number
    reps_max: number
    weight: number | null
    reason: string
    exercise_category: 'big' | 'small'
    day_type: 'UPPER' | 'LOWER'
  }>
  exercises_to_remove: string[]
  cardio_adjustments: {
    current_duration: number
    suggested_duration: number
    current_incline: number
    suggested_incline: number
    current_speed: number
    suggested_speed: number
    reason: string
  } | null
  progression_notes: string[]
  warnings: string[]
  deload_recommended: boolean
  deload_reason?: string
}

// AI Analysis record
export interface AIAnalysis {
  id: string
  user_id: string
  analysis_date: string
  workouts_analyzed: number
  date_range_start: string
  date_range_end: string
  performance_summary: string
  recommendations: AIRecommendations
  days_generated: number
  created_at: string
}

// Type guards
export function isCardioPlanned(workout: PlannedWorkout): workout is CardioPlanned {
  return workout !== null && 'warmup' in workout && 'main' in workout
}

export function isStrengthPlanned(workout: PlannedWorkout): workout is StrengthPlanned {
  return workout !== null && 'exercises' in workout
}

export function isRestPlanned(workout: PlannedWorkout): workout is RestPlanned {
  return workout === null || (!('warmup' in workout) && !('exercises' in workout))
}

export function isCardioActual(workout: ActualWorkout): workout is CardioActual {
  return workout !== null && 'warmup' in workout && 'main' in workout
}

export function isStrengthActual(workout: ActualWorkout): workout is StrengthActual {
  return workout !== null && 'exercises' in workout
}

// API response types
export interface WorkoutDayResponse {
  day: WorkoutDay
}

export interface WorkoutDaysResponse {
  days: WorkoutDay[]
}

export interface GeneratePlanResponse {
  message: string
  days_created: number
}

// Day display helpers
export const WORKOUT_TYPE_COLORS: Record<WorkoutType, string> = {
  REST: 'bg-zinc-700',
  CARDIO: 'bg-blue-600',
  UPPER: 'bg-green-600',
  LOWER: 'bg-purple-600',
  RECOVERY: 'bg-yellow-600',
}

export const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
  REST: 'Rest Day',
  CARDIO: 'Cardio',
  UPPER: 'Upper Body',
  LOWER: 'Lower Body',
  RECOVERY: 'Recovery',
}
