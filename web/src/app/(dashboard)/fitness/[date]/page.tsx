import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { WorkoutDay, WORKOUT_TYPE_LABELS, WORKOUT_TYPE_COLORS } from '@/types/fitness'
import WorkoutDayEditor from '../components/WorkoutDayEditor'

async function getWorkoutDay(userId: string, date: string): Promise<WorkoutDay | null> {
  const supabase = await createClient()

  const { data: day, error } = await supabase
    .from('workout_days')
    .select('*')
    .eq('user_id', userId)
    .eq('workout_date', date)
    .single()

  if (error || !day) {
    return null
  }

  return day as WorkoutDay
}

export default async function WorkoutDayPage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const user = await requireAuth()
  const { date } = await params
  const day = await getWorkoutDay(user.id, date)

  if (!day) {
    notFound()
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/fitness"
          className="p-2 text-zinc-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{formatDate(day.workout_date)}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-sm px-2 py-0.5 rounded ${WORKOUT_TYPE_COLORS[day.workout_type]}`}
            >
              {WORKOUT_TYPE_LABELS[day.workout_type]}
            </span>
            <span className="text-sm text-zinc-400">Week {day.week_number}</span>
            {day.completed_at && (
              <span className="text-sm text-green-500 flex items-center gap-1">
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Completed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Editor */}
      <WorkoutDayEditor workout={day} />
    </div>
  )
}
