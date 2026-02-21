'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  WorkoutDay,
  isCardioPlanned,
  isStrengthPlanned,
  CardioPlanned,
  StrengthPlanned,
  ExercisePlanned,
  CardioSegment,
} from '@/types/fitness'

interface WorkoutDayEditorProps {
  workout: WorkoutDay
}

export default function WorkoutDayEditor({ workout }: WorkoutDayEditorProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'planned' | 'actual'>('planned')
  const [isSaving, setIsSaving] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [notes, setNotes] = useState(workout.notes || '')
  const [foodNotes, setFoodNotes] = useState(workout.food_notes || '')

  // Planned workout state
  const [plannedWorkout, setPlannedWorkout] = useState(workout.planned_json)

  // Actual workout state (starts as copy of planned if no actual exists)
  const [actualWorkout, setActualWorkout] = useState(
    workout.actual_json || workout.planned_json
  )

  // Sync planned changes to actual (only if not completed)
  const updatePlannedWorkout = (updated: typeof plannedWorkout) => {
    setPlannedWorkout(updated)
    // Auto-sync to actual if workout isn't completed yet
    if (!workout.completed_at) {
      setActualWorkout(updated)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const body: Record<string, unknown> = { notes, food_notes: foodNotes }

      if (activeTab === 'planned') {
        // Save both planned and actual (since they're synced when editing planned)
        body.planned_json = plannedWorkout
        if (!workout.completed_at) {
          body.actual_json = plannedWorkout
        }
      } else {
        body.actual_json = actualWorkout
      }

      const res = await fetch(`/api/fitness/days/${workout.workout_date}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error('Error saving workout:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleMarkComplete = async () => {
    setIsCompleting(true)
    try {
      const res = await fetch(`/api/fitness/days/${workout.workout_date}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completed: !workout.completed_at,
          actual_json: actualWorkout,
        }),
      })

      if (res.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error('Error marking complete:', error)
    } finally {
      setIsCompleting(false)
    }
  }

  const currentWorkout = activeTab === 'planned' ? plannedWorkout : actualWorkout
  const setCurrentWorkout = activeTab === 'planned' ? updatePlannedWorkout : setActualWorkout

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('planned')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'planned'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Planned
        </button>
        <button
          onClick={() => setActiveTab('actual')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'actual'
              ? 'text-white border-b-2 border-green-500'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Actual
        </button>
      </div>

      {/* Editor Content */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        {isCardioPlanned(currentWorkout) && (
          <CardioEditor
            workout={currentWorkout}
            onChange={(updated) => setCurrentWorkout(updated)}
          />
        )}

        {isStrengthPlanned(currentWorkout) && (
          <StrengthEditor
            workout={currentWorkout}
            onChange={(updated) => setCurrentWorkout(updated)}
            isActual={activeTab === 'actual'}
          />
        )}

        {(workout.workout_type === 'REST' || workout.workout_type === 'RECOVERY') && (
          <div className="text-zinc-400">
            {workout.workout_type === 'REST' ? (
              <p>Full rest day - no workout required!</p>
            ) : (
              <div>
                <p className="mb-4">Optional recovery activities:</p>
                <ul className="list-disc list-inside space-y-2 text-sm">
                  <li>Light stretching (10-15 minutes)</li>
                  <li>Foam rolling major muscle groups</li>
                  <li>Gentle walk (20-30 minutes)</li>
                  <li>Yoga or mobility work</li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Workout Notes</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this workout..."
            className="w-full h-20 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <h3 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
            <span>Food Notes</span>
            <span className="text-xs text-zinc-500 font-normal">(optional - restaurant meals, alcohol, etc.)</span>
          </h3>
          <textarea
            value={foodNotes}
            onChange={(e) => setFoodNotes(e.target.value)}
            placeholder="e.g., Went to steakhouse - big meal with drinks..."
            className="w-full h-16 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={handleMarkComplete}
          disabled={isCompleting}
          className={`flex-1 px-4 py-3 font-medium rounded-lg transition-colors ${
            workout.completed_at
              ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isCompleting
            ? 'Saving...'
            : workout.completed_at
            ? 'Mark Incomplete'
            : 'Mark Completed'}
        </button>
      </div>
    </div>
  )
}

// Cardio Editor Component
function CardioEditor({
  workout,
  onChange,
}: {
  workout: CardioPlanned
  onChange: (workout: CardioPlanned) => void
}) {
  const updateSegment = (
    segment: 'warmup' | 'main' | 'cooldown',
    field: keyof CardioSegment,
    value: number
  ) => {
    onChange({
      ...workout,
      [segment]: {
        ...workout[segment],
        [field]: value,
      },
    })
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white">Treadmill Session</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
        {/* Warmup */}
        <CardioSegmentEditor
          label="Warmup"
          segment={workout.warmup}
          onChange={(updated) => onChange({ ...workout, warmup: updated })}
        />

        {/* Main */}
        <CardioSegmentEditor
          label="Main"
          segment={workout.main}
          onChange={(updated) => onChange({ ...workout, main: updated })}
          highlight
        />

        {/* Cooldown */}
        <CardioSegmentEditor
          label="Cooldown"
          segment={workout.cooldown}
          onChange={(updated) => onChange({ ...workout, cooldown: updated })}
        />
      </div>

      <div className="text-sm text-zinc-400">
        Total: {workout.warmup.duration + workout.main.duration + workout.cooldown.duration} minutes
      </div>
    </div>
  )
}

function CardioSegmentEditor({
  label,
  segment,
  onChange,
  highlight = false,
}: {
  label: string
  segment: CardioSegment
  onChange: (segment: CardioSegment) => void
  highlight?: boolean
}) {
  // Use string state for inputs to allow clearing
  const handleNumberChange = (field: keyof CardioSegment, value: string) => {
    const parsed = field === 'duration' ? parseInt(value) : parseFloat(value)
    onChange({ ...segment, [field]: isNaN(parsed) ? 0 : parsed })
  }

  return (
    <div
      className={`p-4 rounded-lg ${
        highlight ? 'bg-blue-600/20 border border-blue-600/30' : 'bg-zinc-800'
      }`}
    >
      <h4 className={`font-medium mb-4 ${highlight ? 'text-blue-400' : 'text-zinc-400'}`}>
        {label}
      </h4>
      <div className="grid grid-cols-3 sm:grid-cols-1 gap-3 sm:gap-4">
        <div>
          <label className="block text-xs sm:text-sm text-zinc-500 mb-1">Duration</label>
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              value={segment.duration === 0 ? '' : segment.duration}
              onChange={(e) => handleNumberChange('duration', e.target.value)}
              placeholder="0"
              className="w-full px-2 sm:px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-zinc-500 sm:hidden">min</span>
          </div>
        </div>
        <div>
          <label className="block text-xs sm:text-sm text-zinc-500 mb-1">Incline</label>
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="decimal"
              value={segment.incline === 0 ? '' : segment.incline}
              onChange={(e) => handleNumberChange('incline', e.target.value)}
              placeholder="0"
              className="w-full px-2 sm:px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-zinc-500 sm:hidden">%</span>
          </div>
        </div>
        <div>
          <label className="block text-xs sm:text-sm text-zinc-500 mb-1">Speed</label>
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="decimal"
              value={segment.speed === 0 ? '' : segment.speed}
              onChange={(e) => handleNumberChange('speed', e.target.value)}
              placeholder="0"
              className="w-full px-2 sm:px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-zinc-500 sm:hidden">mph</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Strength Editor Component
function StrengthEditor({
  workout,
  onChange,
  isActual = false,
}: {
  workout: StrengthPlanned
  onChange: (workout: StrengthPlanned) => void
  isActual?: boolean
}) {
  const updateExercise = (index: number, updated: ExercisePlanned) => {
    const newExercises = [...workout.exercises]
    newExercises[index] = updated
    onChange({ ...workout, exercises: newExercises })
  }

  const addExercise = () => {
    onChange({
      ...workout,
      exercises: [
        ...workout.exercises,
        {
          name: 'New Exercise',
          sets: 3,
          reps_min: 8,
          reps_max: 10,
          weight: null,
          exercise_category: 'small',
        },
      ],
    })
  }

  const removeExercise = (index: number) => {
    const newExercises = workout.exercises.filter((_, i) => i !== index)
    onChange({ ...workout, exercises: newExercises })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Exercises</h3>
        <button
          onClick={addExercise}
          className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
        >
          + Add Exercise
        </button>
      </div>

      <div className="space-y-4">
        {workout.exercises.map((exercise, idx) => (
          <ExerciseEditor
            key={idx}
            exercise={exercise}
            onChange={(updated) => updateExercise(idx, updated)}
            onRemove={() => removeExercise(idx)}
            isActual={isActual}
          />
        ))}
      </div>
    </div>
  )
}

function ExerciseEditor({
  exercise,
  onChange,
  onRemove,
  isActual = false,
}: {
  exercise: ExercisePlanned
  onChange: (exercise: ExercisePlanned) => void
  onRemove: () => void
  isActual?: boolean
}) {
  return (
    <div
      className={`p-4 rounded-lg ${
        exercise.is_optional
          ? 'bg-zinc-800/50 border border-dashed border-zinc-700'
          : 'bg-zinc-800'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <input
          type="text"
          value={exercise.name}
          onChange={(e) => onChange({ ...exercise, name: e.target.value })}
          className="text-lg font-medium bg-transparent border-none text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -ml-1"
        />
        <button
          onClick={onRemove}
          className="p-1 text-zinc-500 hover:text-red-500 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div>
          <label className="block text-xs sm:text-sm text-zinc-500 mb-1">Sets</label>
          <select
            value={exercise.sets}
            onChange={(e) => onChange({ ...exercise, sets: parseInt(e.target.value) })}
            className="w-full px-2 sm:px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs sm:text-sm text-zinc-500 mb-1">Reps</label>
          <div className="flex gap-1 items-center">
            <select
              value={exercise.reps_min}
              onChange={(e) => onChange({ ...exercise, reps_min: parseInt(e.target.value) })}
              className="w-full px-1 sm:px-2 py-2 bg-zinc-700 border border-zinc-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="text-zinc-500 text-xs">-</span>
            <select
              value={exercise.reps_max}
              onChange={(e) => onChange({ ...exercise, reps_max: parseInt(e.target.value) })}
              className="w-full px-1 sm:px-2 py-2 bg-zinc-700 border border-zinc-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs sm:text-sm text-zinc-500 mb-1">Weight</label>
          <input
            type="number"
            value={exercise.weight || ''}
            onChange={(e) =>
              onChange({
                ...exercise,
                weight: e.target.value ? parseFloat(e.target.value) : null,
              })
            }
            min="0"
            step="2.5"
            placeholder="BW"
            className="w-full px-2 sm:px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs sm:text-sm text-zinc-500 mb-1">Category</label>
          <select
            value={exercise.exercise_category}
            onChange={(e) =>
              onChange({
                ...exercise,
                exercise_category: e.target.value as 'big' | 'small',
              })
            }
            className="w-full px-2 sm:px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="big">Big</option>
            <option value="small">Small</option>
          </select>
        </div>
      </div>

      <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center">
        <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={exercise.is_optional || false}
            onChange={(e) => onChange({ ...exercise, is_optional: e.target.checked })}
            className="w-4 h-4 rounded bg-zinc-700 border-zinc-600 text-blue-600 focus:ring-blue-500"
          />
          Optional
        </label>
        <input
          type="text"
          value={exercise.notes || ''}
          onChange={(e) => onChange({ ...exercise, notes: e.target.value || undefined })}
          placeholder="Notes..."
          className="flex-1 px-3 py-2 sm:py-1 text-sm bg-zinc-700 border border-zinc-600 rounded text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  )
}
