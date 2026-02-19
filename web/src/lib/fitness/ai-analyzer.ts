import OpenAI from 'openai'
import {
  WorkoutDay,
  CardioPlanned,
  StrengthPlanned,
  isCardioPlanned,
  isStrengthPlanned,
} from '@/types/fitness'

// Lazy initialization of OpenAI client
let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiClient
}

// Health profile for the user
export interface HealthProfile {
  health_considerations: string | null
  fitness_goals: string | null
  experience_level: string
}

// AI Analysis result
export interface AIAnalysisResult {
  performance_summary: string
  recommendations: {
    exercises_to_modify: ExerciseModification[]
    exercises_to_add: ExerciseSuggestion[]
    exercises_to_remove: string[]
    cardio_adjustments: CardioAdjustment | null
    progression_notes: string[]
    warnings: string[]
    deload_recommended: boolean
    deload_reason?: string
  }
  next_week_plan: GeneratedWorkoutDay[]
}

export interface ExerciseModification {
  exercise_name: string
  current_weight: number | null
  suggested_weight: number | null
  current_sets: number
  suggested_sets: number
  current_reps: string
  suggested_reps: string
  reason: string
}

export interface ExerciseSuggestion {
  name: string
  sets: number
  reps_min: number
  reps_max: number
  weight: number | null
  reason: string
  exercise_category: 'big' | 'small'
  day_type: 'UPPER' | 'LOWER'
}

export interface CardioAdjustment {
  current_duration: number
  suggested_duration: number
  current_incline: number
  suggested_incline: number
  current_speed: number
  suggested_speed: number
  reason: string
}

export interface GeneratedWorkoutDay {
  day_offset: number // 0 = tomorrow, 1 = day after, etc.
  workout_type: 'REST' | 'CARDIO' | 'UPPER' | 'LOWER' | 'RECOVERY'
  planned_json: CardioPlanned | StrengthPlanned | null
  ai_notes: string
}

// System prompt with health considerations
function buildSystemPrompt(healthProfile: HealthProfile): string {
  return `You are an expert fitness coach and exercise physiologist. You analyze workout data and create personalized training plans.

CRITICAL HEALTH CONSIDERATION:
The user has CHRONIC BACK PROBLEMS. This is your top priority when making recommendations:
- AVOID exercises that put strain on the lower back: traditional deadlifts, barbell back squats, bent-over rows with heavy weight, sit-ups/crunches, leg press with excessive depth
- PREFER back-friendly alternatives: goblet squats, leg press (controlled depth), Romanian deadlifts with light-moderate weight and perfect form, chest-supported rows, lat pulldowns, planks, bird-dogs, dead bugs
- INCLUDE exercises that strengthen the back safely over time: planks, side planks, bird-dogs, glute bridges, hip hinges with light weight, face pulls, band pull-aparts
- Progress VERY SLOWLY on any exercise involving the posterior chain
- If any exercise causes back discomfort, immediately suggest a safer alternative
- Prioritize core stability and hip mobility work

${healthProfile.health_considerations ? `Additional health notes from user: ${healthProfile.health_considerations}` : ''}

User's fitness goals: ${healthProfile.fitness_goals || 'General fitness and strength'}
Experience level: ${healthProfile.experience_level || 'beginner'}

WORKOUT STRUCTURE:
- Weekly pattern: Mon=Upper, Tue=Cardio, Wed=Lower, Thu=Cardio, Fri=Upper, Sat=Cardio or Recovery (alternating), Sun=Rest (mandatory)
- Cardio: Treadmill walking with incline (warmup, main, cooldown segments)
- Upper: Chest, back, shoulders, arms
- Lower: Quads, hamstrings, glutes, calves

PROGRESSION RULES:
- Big lifts (bench, squat alternatives, RDL): +5 lbs/week IF all sets completed with good form
- Small lifts (curls, raises): +2.5 lbs/week
- Cardio: Alternate between +2 min duration and +0.5-1% incline weekly
- Cap incline at 8% for joint health
- If user missed workouts or underperformed, maintain or slightly reduce weights
- Recommend deload (reduce weights 40-50%) every 4-6 weeks or when signs of fatigue

OUTPUT FORMAT:
Respond with valid JSON matching this structure exactly:
{
  "performance_summary": "2-3 sentence summary of how the user performed",
  "recommendations": {
    "exercises_to_modify": [
      {
        "exercise_name": "string",
        "current_weight": number or null,
        "suggested_weight": number or null,
        "current_sets": number,
        "suggested_sets": number,
        "current_reps": "string like '6-8'",
        "suggested_reps": "string like '8-10'",
        "reason": "string"
      }
    ],
    "exercises_to_add": [
      {
        "name": "string",
        "sets": number,
        "reps_min": number,
        "reps_max": number,
        "weight": number or null,
        "reason": "string",
        "exercise_category": "big" or "small",
        "day_type": "UPPER" or "LOWER"
      }
    ],
    "exercises_to_remove": ["exercise names to remove"],
    "cardio_adjustments": {
      "current_duration": number,
      "suggested_duration": number,
      "current_incline": number,
      "suggested_incline": number,
      "current_speed": number,
      "suggested_speed": number,
      "reason": "string"
    } or null,
    "progression_notes": ["array of notes about progression"],
    "warnings": ["any health or form warnings"],
    "deload_recommended": boolean,
    "deload_reason": "string if deload recommended"
  },
  "next_week_plan": [
    {
      "day_offset": number (0=tomorrow),
      "workout_type": "UPPER" | "LOWER" | "CARDIO" | "REST" | "RECOVERY",
      "planned_json": { workout object matching type },
      "ai_notes": "brief note about this day"
    }
  ]
}

For planned_json, use these structures:
- CARDIO: { "warmup": { "incline": 0, "speed": 3.0, "duration": 5 }, "main": { "incline": 4, "speed": 3.0, "duration": 20 }, "cooldown": { "incline": 0, "speed": 3.0, "duration": 5 } }
- UPPER/LOWER: { "exercises": [ { "name": "string", "sets": 3, "reps_min": 6, "reps_max": 8, "weight": 45, "exercise_category": "big", "is_optional": false } ] }
- REST/RECOVERY: null`
}

// Format workout data for the AI
function formatWorkoutsForAnalysis(workouts: WorkoutDay[]): string {
  const completed = workouts.filter(w => w.completed_at)
  const missed = workouts.filter(w => !w.completed_at && w.workout_type !== 'REST')

  let analysis = `COMPLETED WORKOUTS (${completed.length}):\n`

  completed.forEach(w => {
    analysis += `\n${w.workout_date} - ${w.workout_type} (Week ${w.week_number}):\n`

    if (isCardioPlanned(w.actual_json || w.planned_json)) {
      const cardio = (w.actual_json || w.planned_json) as CardioPlanned
      analysis += `  Warmup: ${cardio.warmup.duration}min @ ${cardio.warmup.incline}% incline, ${cardio.warmup.speed}mph\n`
      analysis += `  Main: ${cardio.main.duration}min @ ${cardio.main.incline}% incline, ${cardio.main.speed}mph\n`
      analysis += `  Cooldown: ${cardio.cooldown.duration}min @ ${cardio.cooldown.incline}% incline, ${cardio.cooldown.speed}mph\n`
    }

    if (isStrengthPlanned(w.actual_json || w.planned_json)) {
      const strength = (w.actual_json || w.planned_json) as StrengthPlanned
      strength.exercises.forEach(ex => {
        analysis += `  - ${ex.name}: ${ex.sets}x${ex.reps_min}-${ex.reps_max} @ ${ex.weight || 'BW'}lbs${ex.is_optional ? ' (optional)' : ''}\n`
      })
    }

    if (w.notes) {
      analysis += `  Notes: ${w.notes}\n`
    }
  })

  if (missed.length > 0) {
    analysis += `\nMISSED WORKOUTS (${missed.length}):\n`
    missed.forEach(w => {
      analysis += `  ${w.workout_date} - ${w.workout_type}\n`
    })
  }

  return analysis
}

// Get the current exercise weights from most recent workouts
function getCurrentWeights(workouts: WorkoutDay[]): Record<string, number | null> {
  const weights: Record<string, number | null> = {}

  // Sort by date descending to get most recent first
  const sorted = [...workouts]
    .filter(w => w.completed_at && isStrengthPlanned(w.actual_json || w.planned_json))
    .sort((a, b) => b.workout_date.localeCompare(a.workout_date))

  sorted.forEach(w => {
    const strength = (w.actual_json || w.planned_json) as StrengthPlanned
    strength.exercises.forEach(ex => {
      if (!(ex.name in weights)) {
        weights[ex.name] = ex.weight
      }
    })
  })

  return weights
}

// Main analysis function
export async function analyzeWorkoutsAndGeneratePlan(
  workouts: WorkoutDay[],
  healthProfile: HealthProfile,
  daysToGenerate: number = 7
): Promise<AIAnalysisResult> {
  const systemPrompt = buildSystemPrompt(healthProfile)
  const workoutData = formatWorkoutsForAnalysis(workouts)
  const currentWeights = getCurrentWeights(workouts)

  const userPrompt = `Analyze the following workout history and generate a plan for the next ${daysToGenerate} days.

Current exercise weights (most recent):
${Object.entries(currentWeights).map(([name, weight]) => `- ${name}: ${weight || 'bodyweight'}lbs`).join('\n')}

${workoutData}

Based on this data:
1. Summarize performance
2. Recommend any exercise modifications (considering the back issues)
3. Suggest any exercises to add or remove (prioritize back-friendly options)
4. Adjust cardio parameters if needed
5. Generate the next ${daysToGenerate} days of workouts following the weekly pattern

Remember: The user has chronic back problems. Be conservative with progression and prioritize exercises that protect and strengthen the back safely.`

  const openai = getOpenAIClient()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from OpenAI')
  }

  const result = JSON.parse(content) as AIAnalysisResult
  return result
}

// Generate a single week's plan without full analysis (lighter weight)
export async function generateWeekPlan(
  lastWorkout: WorkoutDay | null,
  healthProfile: HealthProfile,
  startDate: string,
  currentWeights: Record<string, number | null>
): Promise<GeneratedWorkoutDay[]> {
  const systemPrompt = buildSystemPrompt(healthProfile)

  const userPrompt = `Generate a 7-day workout plan starting from ${startDate}.

Current exercise weights:
${Object.entries(currentWeights).map(([name, weight]) => `- ${name}: ${weight || 'bodyweight'}lbs`).join('\n')}

${lastWorkout ? `Last completed workout: ${lastWorkout.workout_date} - ${lastWorkout.workout_type}` : 'No previous workout data.'}

Generate 7 days following the weekly pattern (Mon=Upper, Tue=Cardio, Wed=Lower, Thu=Cardio, Fri=Upper, Sat=Cardio/Recovery alternating, Sun=Rest).

Apply modest progression (+2.5-5lbs for strength, +1-2min or +0.5% for cardio) while keeping exercises back-friendly.

Return only the next_week_plan array in your JSON response.`

  const openai = getOpenAIClient()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // Use smaller model for simple generation
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from OpenAI')
  }

  const result = JSON.parse(content)
  return result.next_week_plan || []
}
