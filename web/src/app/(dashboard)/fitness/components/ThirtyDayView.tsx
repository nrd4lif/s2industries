'use client'

import Link from 'next/link'
import { WorkoutDay, WORKOUT_TYPE_COLORS, WORKOUT_TYPE_LABELS } from '@/types/fitness'

interface ThirtyDayViewProps {
  days: WorkoutDay[]
  today: string
}

export default function ThirtyDayView({ days, today }: ThirtyDayViewProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    return {
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
    }
  }

  const isToday = (dateStr: string) => dateStr === today

  const isPast = (dateStr: string) => dateStr < today

  // Group days by week
  const weeks: WorkoutDay[][] = []
  let currentWeek: WorkoutDay[] = []

  days.forEach((day, idx) => {
    const date = new Date(day.workout_date + 'T12:00:00')
    const dayOfWeek = date.getDay()

    // Start new week on Sunday (dayOfWeek === 0) but not for the first day
    if (dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    currentWeek.push(day)

    // Push final week
    if (idx === days.length - 1 && currentWeek.length > 0) {
      weeks.push(currentWeek)
    }
  })

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">30-Day Outlook</h2>

      <div className="space-y-4">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-zinc-800/50 border-b border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-400">
                Week {week[0]?.week_number || weekIdx + 1}
              </h3>
            </div>
            <div className="grid grid-cols-7 divide-x divide-zinc-800">
              {week.map((day) => {
                const { dayName, dayNum, month } = formatDate(day.workout_date)
                const dayIsToday = isToday(day.workout_date)
                const dayIsPast = isPast(day.workout_date)

                return (
                  <Link
                    key={day.workout_date}
                    href={`/fitness/${day.workout_date}`}
                    className={`p-3 text-center transition-colors hover:bg-zinc-800 ${
                      dayIsToday ? 'bg-zinc-800' : ''
                    }`}
                  >
                    {/* Day name */}
                    <p className="text-xs text-zinc-500 mb-1">{dayName}</p>

                    {/* Day number */}
                    <p
                      className={`text-lg font-semibold mb-2 ${
                        dayIsToday
                          ? 'text-white'
                          : dayIsPast
                          ? 'text-zinc-500'
                          : 'text-zinc-300'
                      }`}
                    >
                      {dayNum}
                    </p>

                    {/* Month (only show for first day or first of month) */}
                    {(dayNum === 1 || week.indexOf(day) === 0) && (
                      <p className="text-xs text-zinc-600 mb-2">{month}</p>
                    )}

                    {/* Workout type badge */}
                    <div
                      className={`text-xs px-2 py-1 rounded ${
                        WORKOUT_TYPE_COLORS[day.workout_type]
                      } ${dayIsPast && !day.completed_at ? 'opacity-50' : ''}`}
                    >
                      <span className="text-white font-medium">
                        {day.workout_type === 'REST' ? 'Rest' :
                         day.workout_type === 'RECOVERY' ? 'Rec' :
                         day.workout_type === 'CARDIO' ? 'Cardio' :
                         day.workout_type === 'UPPER' ? 'Upper' :
                         day.workout_type === 'LOWER' ? 'Lower' : ''}
                      </span>
                    </div>

                    {/* Completion status */}
                    {day.completed_at && (
                      <div className="mt-2">
                        <span className="inline-block w-4 h-4 text-green-500">
                          <svg viewBox="0 0 20 20" fill="currentColor">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                      </div>
                    )}

                    {/* Missed indicator for past uncompleted days */}
                    {dayIsPast && !day.completed_at && day.workout_type !== 'REST' && (
                      <div className="mt-2">
                        <span className="inline-block w-4 h-4 text-red-500">
                          <svg viewBox="0 0 20 20" fill="currentColor">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                      </div>
                    )}
                  </Link>
                )
              })}

              {/* Fill empty slots if week is incomplete */}
              {week.length < 7 &&
                Array.from({ length: 7 - week.length }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="p-3" />
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded ${WORKOUT_TYPE_COLORS.CARDIO}`} />
          <span className="text-zinc-400">{WORKOUT_TYPE_LABELS.CARDIO}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded ${WORKOUT_TYPE_COLORS.UPPER}`} />
          <span className="text-zinc-400">{WORKOUT_TYPE_LABELS.UPPER}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded ${WORKOUT_TYPE_COLORS.LOWER}`} />
          <span className="text-zinc-400">{WORKOUT_TYPE_LABELS.LOWER}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded ${WORKOUT_TYPE_COLORS.RECOVERY}`} />
          <span className="text-zinc-400">{WORKOUT_TYPE_LABELS.RECOVERY}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded ${WORKOUT_TYPE_COLORS.REST}`} />
          <span className="text-zinc-400">{WORKOUT_TYPE_LABELS.REST}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-green-500">
            <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <span className="text-zinc-400">Completed</span>
        </div>
      </div>
    </div>
  )
}
