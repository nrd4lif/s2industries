'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  WorkoutDay,
  WORKOUT_TYPE_COLORS,
  WORKOUT_TYPE_LABELS,
  isCardioPlanned,
  isStrengthPlanned,
  CardioPlanned,
  StrengthPlanned,
} from '@/types/fitness'

interface TodayCardProps {
  workout: WorkoutDay
}

export default function TodayCard({ workout }: TodayCardProps) {
  const router = useRouter()
  const [isCompleting, setIsCompleting] = useState(false)

  const handleMarkComplete = async () => {
    setIsCompleting(true)
    try {
      const res = await fetch(`/api/fitness/days/${workout.workout_date}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completed: !workout.completed_at,
          actual_json: workout.planned_json, // Default actuals to planned
        }),
      })

      if (res.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error('Error marking workout complete:', error)
    } finally {
      setIsCompleting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className={`px-6 py-4 ${WORKOUT_TYPE_COLORS[workout.workout_type]}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/80">Today</p>
            <h2 className="text-xl font-bold text-white">
              {WORKOUT_TYPE_LABELS[workout.workout_type]}
            </h2>
            <p className="text-sm text-white/80 mt-1">{formatDate(workout.workout_date)}</p>
          </div>
          {workout.completed_at && (
            <div className="bg-white/20 px-3 py-1 rounded-full">
              <span className="text-white text-sm font-medium">Completed</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Cardio Details */}
        {isCardioPlanned(workout.planned_json) && (
          <CardioDetails plan={workout.planned_json} />
        )}

        {/* Strength Details */}
        {isStrengthPlanned(workout.planned_json) && (
          <StrengthDetails plan={workout.planned_json} />
        )}

        {/* Rest/Recovery */}
        {(workout.workout_type === 'REST' || workout.workout_type === 'RECOVERY') && (
          <div className="text-zinc-400">
            {workout.workout_type === 'REST' ? (
              <p>Full rest day - let your body recover!</p>
            ) : (
              <div>
                <p className="mb-2">Recovery activities (optional):</p>
                <ul className="list-disc list-inside text-sm">
                  <li>Light stretching</li>
                  <li>Foam rolling</li>
                  <li>Gentle walk</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {workout.notes && (
          <div className="mt-4 p-3 bg-zinc-800 rounded-lg">
            <p className="text-sm text-zinc-400">{workout.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => router.push(`/fitness/${workout.workout_date}`)}
            className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            View Details
          </button>
          <button
            onClick={handleMarkComplete}
            disabled={isCompleting}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              workout.completed_at
                ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isCompleting
              ? 'Saving...'
              : workout.completed_at
              ? 'Completed'
              : 'Mark Completed'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CardioDetails({ plan }: { plan: CardioPlanned }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Treadmill Session</h3>
      <div className="grid grid-cols-3 gap-4">
        {/* Warmup */}
        <div className="bg-zinc-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-zinc-400 mb-2">Warmup</h4>
          <div className="space-y-1 text-sm">
            <p className="text-white">{plan.warmup.duration} min</p>
            <p className="text-zinc-400">{plan.warmup.incline}% incline</p>
            <p className="text-zinc-400">{plan.warmup.speed} mph</p>
          </div>
        </div>

        {/* Main */}
        <div className="bg-blue-600/20 border border-blue-600/30 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-400 mb-2">Main</h4>
          <div className="space-y-1 text-sm">
            <p className="text-white font-semibold">{plan.main.duration} min</p>
            <p className="text-blue-300">{plan.main.incline}% incline</p>
            <p className="text-blue-300">{plan.main.speed} mph</p>
          </div>
        </div>

        {/* Cooldown */}
        <div className="bg-zinc-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-zinc-400 mb-2">Cooldown</h4>
          <div className="space-y-1 text-sm">
            <p className="text-white">{plan.cooldown.duration} min</p>
            <p className="text-zinc-400">{plan.cooldown.incline}% incline</p>
            <p className="text-zinc-400">{plan.cooldown.speed} mph</p>
          </div>
        </div>
      </div>

      <div className="text-sm text-zinc-400">
        Total: {plan.warmup.duration + plan.main.duration + plan.cooldown.duration} minutes
      </div>
    </div>
  )
}

function StrengthDetails({ plan }: { plan: StrengthPlanned }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Exercises</h3>
      <div className="space-y-3">
        {plan.exercises.map((exercise, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg ${
              exercise.is_optional
                ? 'bg-zinc-800/50 border border-dashed border-zinc-700'
                : 'bg-zinc-800'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-white">
                  {exercise.name}
                  {exercise.is_optional && (
                    <span className="ml-2 text-xs text-zinc-500">(Optional)</span>
                  )}
                </h4>
                <p className="text-sm text-zinc-400 mt-1">
                  {exercise.sets} sets × {exercise.reps_min}
                  {exercise.reps_min !== exercise.reps_max && `-${exercise.reps_max}`} reps
                </p>
                {exercise.notes && (
                  <p className="text-xs text-zinc-500 mt-1">{exercise.notes}</p>
                )}
              </div>
              <div className="text-right">
                {exercise.weight !== null && (
                  <p className="text-lg font-semibold text-white">{exercise.weight} lbs</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
