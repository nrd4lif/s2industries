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
      dayNameShort: date.toLocaleDateString('en-US', { weekday: 'narrow' }),
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

    if (dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    currentWeek.push(day)

    if (idx === days.length - 1 && currentWeek.length > 0) {
      weeks.push(currentWeek)
    }
  })

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">30-Day Outlook</h2>

      {/* Mobile: List view */}
      <div className="md:hidden space-y-2">
        {days.map((day) => {
          const { dayName, dayNum, month } = formatDate(day.workout_date)
          const dayIsToday = isToday(day.workout_date)
          const dayIsPast = isPast(day.workout_date)

          return (
            <Link
              key={day.workout_date}
              href={`/fitness/${day.workout_date}`}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                dayIsToday
                  ? 'bg-zinc-800 border border-zinc-700'
                  : 'bg-zinc-900 border border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              {/* Date */}
              <div className="w-14 text-center">
                <p className="text-xs text-zinc-500">{dayName}</p>
                <p className={`text-lg font-bold ${dayIsToday ? 'text-white' : dayIsPast ? 'text-zinc-500' : 'text-zinc-300'}`}>
                  {dayNum}
                </p>
                <p className="text-xs text-zinc-600">{month}</p>
              </div>

              {/* Workout type */}
              <div className="flex-1">
                <span
                  className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                    WORKOUT_TYPE_COLORS[day.workout_type]
                  } ${dayIsPast && !day.completed_at ? 'opacity-50' : ''}`}
                >
                  {WORKOUT_TYPE_LABELS[day.workout_type]}
                </span>
                {dayIsToday && (
                  <span className="ml-2 text-xs text-blue-400">Today</span>
                )}
              </div>

              {/* Status */}
              <div className="w-8 flex justify-center">
                {day.completed_at ? (
                  <span className="text-green-500">
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </span>
                ) : dayIsPast && day.workout_type !== 'REST' ? (
                  <span className="text-red-500">
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </span>
                ) : (
                  <span className="text-zinc-600">
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Desktop: Calendar grid view */}
      <div className="hidden md:block space-y-4">
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
                    <p className="text-xs text-zinc-500 mb-1">{dayName}</p>
                    <p className={`text-lg font-semibold mb-2 ${dayIsToday ? 'text-white' : dayIsPast ? 'text-zinc-500' : 'text-zinc-300'}`}>
                      {dayNum}
                    </p>
                    {(dayNum === 1 || week.indexOf(day) === 0) && (
                      <p className="text-xs text-zinc-600 mb-2">{month}</p>
                    )}
                    <div className={`text-xs px-2 py-1 rounded ${WORKOUT_TYPE_COLORS[day.workout_type]} ${dayIsPast && !day.completed_at ? 'opacity-50' : ''}`}>
                      <span className="text-white font-medium">
                        {day.workout_type === 'REST' ? 'Rest' :
                         day.workout_type === 'RECOVERY' ? 'Rec' :
                         day.workout_type === 'CARDIO' ? 'Cardio' :
                         day.workout_type === 'UPPER' ? 'Upper' :
                         day.workout_type === 'LOWER' ? 'Lower' : ''}
                      </span>
                    </div>
                    {day.completed_at && (
                      <div className="mt-2">
                        <span className="inline-block w-4 h-4 text-green-500">
                          <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </span>
                      </div>
                    )}
                    {dayIsPast && !day.completed_at && day.workout_type !== 'REST' && (
                      <div className="mt-2">
                        <span className="inline-block w-4 h-4 text-red-500">
                          <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </span>
                      </div>
                    )}
                  </Link>
                )
              })}
              {week.length < 7 &&
                Array.from({ length: 7 - week.length }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="p-3" />
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-sm">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded ${WORKOUT_TYPE_COLORS.CARDIO}`} />
          <span className="text-zinc-400">Cardio</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded ${WORKOUT_TYPE_COLORS.UPPER}`} />
          <span className="text-zinc-400">Upper</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded ${WORKOUT_TYPE_COLORS.LOWER}`} />
          <span className="text-zinc-400">Lower</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded ${WORKOUT_TYPE_COLORS.RECOVERY}`} />
          <span className="text-zinc-400">Recovery</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded ${WORKOUT_TYPE_COLORS.REST}`} />
          <span className="text-zinc-400">Rest</span>
        </div>
      </div>
    </div>
  )
}
