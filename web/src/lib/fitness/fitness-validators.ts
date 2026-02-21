import { z } from 'zod'

// Cardio segment schema
const cardioSegmentSchema = z.object({
  incline: z.number().min(0).max(15),
  speed: z.number().min(0.5).max(12),
  duration: z.number().min(1).max(120),
})

// Cardio planned schema
export const cardioPlannedSchema = z.object({
  warmup: cardioSegmentSchema,
  main: cardioSegmentSchema,
  cooldown: cardioSegmentSchema,
})

// Exercise planned schema
export const exercisePlannedSchema = z.object({
  name: z.string().min(1).max(100),
  sets: z.number().min(1).max(10),
  reps_min: z.number().min(1).max(100),
  reps_max: z.number().min(1).max(100),
  weight: z.number().min(0).nullable(),
  notes: z.string().max(500).optional(),
  is_optional: z.boolean().optional(),
  exercise_category: z.enum(['big', 'small']),
})

// Set actual schema
const setActualSchema = z.object({
  reps: z.number().min(0).max(100),
  weight: z.number().min(0).nullable(),
})

// Exercise actual schema
export const exerciseActualSchema = exercisePlannedSchema.extend({
  sets_completed: z.array(setActualSchema),
})

// Strength planned schema
export const strengthPlannedSchema = z.object({
  exercises: z.array(exercisePlannedSchema),
})

// Strength actual schema
export const strengthActualSchema = z.object({
  exercises: z.array(exerciseActualSchema),
})

// Rest planned schema
export const restPlannedSchema = z.object({
  notes: z.string().max(500).optional(),
  suggested_activity: z.string().max(200).optional(),
}).nullable()

// Workout type enum
export const workoutTypeSchema = z.enum(['REST', 'CARDIO', 'UPPER', 'LOWER', 'RECOVERY'])

// Update workout day schema
export const updateWorkoutDaySchema = z.object({
  workout_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  planned_json: z.union([
    cardioPlannedSchema,
    strengthPlannedSchema,
    restPlannedSchema,
  ]).nullable().optional(),
  actual_json: z.union([
    cardioPlannedSchema.extend({
      warmup: cardioSegmentSchema,
      main: cardioSegmentSchema,
      cooldown: cardioSegmentSchema,
    }),
    strengthActualSchema,
    restPlannedSchema,
  ]).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  food_notes: z.string().max(1000).nullable().optional(),
})

// Mark complete schema
export const markCompleteSchema = z.object({
  workout_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  completed: z.boolean(),
  actual_json: z.union([
    cardioPlannedSchema,
    strengthActualSchema,
    restPlannedSchema,
  ]).nullable().optional(),
})

// Generate plan schema
export const generatePlanSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.number().min(1).max(90).optional().default(30),
})

// User fitness settings schema
export const userFitnessSettingsSchema = z.object({
  default_treadmill_speed: z.number().min(0.5).max(12).optional(),
  default_warmup_minutes: z.number().min(1).max(30).optional(),
  default_cooldown_minutes: z.number().min(1).max(30).optional(),
  starting_incline: z.number().min(0).max(15).optional(),
  progression_type: z.enum(['automatic', 'manual']).optional(),
  prefer_rep_increase: z.boolean().optional(),
  bench_weight: z.number().min(0).max(500).optional(),
  row_weight: z.number().min(0).max(500).optional(),
  overhead_press_weight: z.number().min(0).max(300).optional(),
  lat_pulldown_weight: z.number().min(0).max(400).optional(),
  curl_weight: z.number().min(0).max(100).optional(),
  tricep_weight: z.number().min(0).max(100).optional(),
  squat_weight: z.number().min(0).max(600).optional(),
  rdl_weight: z.number().min(0).max(500).optional(),
  lunge_weight: z.number().min(0).max(200).optional(),
  hamstring_curl_weight: z.number().min(0).max(300).optional(),
  calf_raise_weight: z.number().min(0).max(500).optional(),
  timezone: z.string().max(50).optional(),
})

// Type exports
export type CardioPlannedInput = z.infer<typeof cardioPlannedSchema>
export type StrengthPlannedInput = z.infer<typeof strengthPlannedSchema>
export type UpdateWorkoutDayInput = z.infer<typeof updateWorkoutDaySchema>
export type MarkCompleteInput = z.infer<typeof markCompleteSchema>
export type GeneratePlanInput = z.infer<typeof generatePlanSchema>
export type UserFitnessSettingsInput = z.infer<typeof userFitnessSettingsSchema>
