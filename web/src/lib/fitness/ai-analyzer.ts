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

// AI Analysis result - recommendations only, no plan generation
export interface AIAnalysisResult {
  performance_summary: string
  recommendations: {
    weight_adjustments: WeightAdjustment[]
    exercise_swaps: ExerciseSwap[]
    exercises_to_add: ExerciseSuggestion[]
    cardio_adjustments: CardioAdjustment | null
    progression_notes: string[]
    warnings: string[]
    deload_recommended: boolean
    deload_reason?: string
  }
}

export interface WeightAdjustment {
  exercise_name: string
  current_weight: number | null
  suggested_weight: number | null
  reason: string
}

export interface ExerciseSwap {
  original_exercise: string
  replacement_exercise: string
  reason: string
  sets: number
  reps_min: number
  reps_max: number
  weight: number | null
  exercise_category: 'big' | 'small'
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

// System prompt with health considerations
function buildSystemPrompt(healthProfile: HealthProfile): string {
  return `You are an expert fitness coach and exercise physiologist. You analyze workout data and provide recommendations to adjust an EXISTING workout plan.

CRITICAL: You are NOT generating new workout plans. You are providing RECOMMENDATIONS to modify the user's existing plan. The user already has a structured program with:
- Upper body days: Bench Press, Seated Cable Row, Overhead Press, Lat Pulldown, Bicep Curls, Tricep Pushdowns
- Lower body days: Squat/Leg Press, Romanian Deadlift, Walking Lunges, Hamstring Curl, Calf Raises
- Cardio days: Treadmill walking with warmup, main, and cooldown segments
- Rest days: Every Sunday (mandatory) and Recovery days every other Saturday

Your job is to suggest:
1. Weight adjustments based on performance
2. Exercise SWAPS if an exercise is unsafe for their back (not removals - always provide alternatives)
3. Additional exercises to add for back health
4. Cardio parameter tweaks

CRITICAL HEALTH CONSIDERATION:
The user has CHRONIC BACK PROBLEMS. This is your top priority:
- If you see exercises that strain the lower back, suggest SWAPS (not removals):
  - Traditional deadlifts → Trap bar deadlifts or lighter Romanian deadlifts
  - Barbell back squats → Goblet squats or leg press (controlled depth)
  - Bent-over rows → Chest-supported rows or seated cable rows
  - Sit-ups/crunches → Planks, dead bugs, bird-dogs
- ALWAYS suggest back-strengthening additions: planks, bird-dogs, glute bridges, face pulls
- Progress VERY SLOWLY on posterior chain exercises
- Be conservative with weight increases

${healthProfile.health_considerations ? `Additional health notes from user: ${healthProfile.health_considerations}` : ''}

User's fitness goals: ${healthProfile.fitness_goals || 'General fitness and strength'}
Experience level: ${healthProfile.experience_level || 'beginner'}

PROGRESSION RULES:
- Big lifts (bench, squat alternatives, RDL): +5 lbs/week IF all sets completed with good form
- Small lifts (curls, raises): +2.5 lbs/week
- Cardio: Alternate between +2 min duration and +0.5-1% incline weekly
- Cap incline at 8% for joint health
- If user missed workouts or underperformed, maintain or slightly reduce weights
- Recommend deload (reduce weights 40-50%) every 4-6 weeks or when signs of fatigue

NUTRITION NOTES:
- The user may include "food notes" for some days indicating dietary deviations (restaurant meals, alcohol, high-fat meals, etc.)
- Consider these when recommending workout intensity the following day:
  - Heavy meal/alcohol → suggest lighter workout, focus on form over weight
  - High fat/carb meal → may have extra energy, but don't push too hard
  - If multiple consecutive days of poor nutrition → mention it as a warning and suggest returning to normal diet

OUTPUT FORMAT:
Respond with valid JSON matching this structure exactly:
{
  "performance_summary": "2-3 sentence summary of how the user performed",
  "recommendations": {
    "weight_adjustments": [
      {
        "exercise_name": "exact exercise name from their plan",
        "current_weight": number or null,
        "suggested_weight": number or null,
        "reason": "string"
      }
    ],
    "exercise_swaps": [
      {
        "original_exercise": "exercise to replace",
        "replacement_exercise": "safer alternative",
        "reason": "why this swap helps their back",
        "sets": number,
        "reps_min": number,
        "reps_max": number,
        "weight": number or null,
        "exercise_category": "big" or "small"
      }
    ],
    "exercises_to_add": [
      {
        "name": "string",
        "sets": number,
        "reps_min": number,
        "reps_max": number,
        "weight": number or null,
        "reason": "string - especially for back health",
        "exercise_category": "big" or "small",
        "day_type": "UPPER" or "LOWER"
      }
    ],
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
  }
}

IMPORTANT: Only suggest swaps/additions if truly necessary for safety or progression. Don't change things that are working well.`
}

// Format workout data for the AI
function formatWorkoutsForAnalysis(workouts: WorkoutDay[]): string {
  const completed = workouts.filter(w => w.completed_at)
  const missed = workouts.filter(w => !w.completed_at && w.workout_type !== 'REST' && w.workout_type !== 'RECOVERY')

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
    if (w.food_notes) {
      analysis += `  Food notes: ${w.food_notes}\n`
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

// Main analysis function - returns recommendations only
export async function analyzeWorkouts(
  workouts: WorkoutDay[],
  healthProfile: HealthProfile
): Promise<AIAnalysisResult> {
  const systemPrompt = buildSystemPrompt(healthProfile)
  const workoutData = formatWorkoutsForAnalysis(workouts)
  const currentWeights = getCurrentWeights(workouts)

  const userPrompt = `Analyze the following workout history and provide recommendations.

Current exercise weights (most recent):
${Object.entries(currentWeights).map(([name, weight]) => `- ${name}: ${weight || 'bodyweight'}lbs`).join('\n') || 'No weight data yet'}

${workoutData}

Based on this data:
1. Summarize their performance
2. Recommend weight adjustments for exercises they're doing
3. Suggest any exercise swaps needed for back safety (always provide alternatives, don't just remove)
4. Suggest any back-strengthening exercises to add
5. Recommend cardio adjustments if needed

Remember: The user has chronic back problems. Be conservative with progression and prioritize exercises that protect and strengthen the back safely. Keep their existing program structure - only suggest modifications where truly needed.`

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
