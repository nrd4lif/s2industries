'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AIRecommendations } from '@/types/fitness'

interface AIInsightsProps {
  recommendations: AIRecommendations | null
  lastAnalysisAt: string | null
}

export default function AIInsights({ recommendations, lastAnalysisAt }: AIInsightsProps) {
  const router = useRouter()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true)
    setError(null)

    try {
      const res = await fetch('/api/fitness/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days_to_analyze: 30 }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Analysis failed')
        return
      }

      router.refresh()
    } catch {
      setError('Failed to run analysis')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleRegenerate = async () => {
    if (!confirm('This will reset all future workouts to the original templates. Continue?')) {
      return
    }

    setIsRegenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/fitness/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Regeneration failed')
        return
      }

      router.refresh()
    } catch {
      setError('Failed to regenerate workouts')
    } finally {
      setIsRegenerating(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 sm:px-6 sm:py-4 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-purple-400">AI</span> Insights
            </h2>
            {lastAnalysisAt && (
              <p className="text-xs text-zinc-400 mt-1">
                Last analyzed: {formatDate(lastAnalysisAt)}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-700/50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isRegenerating ? 'Resetting...' : 'Reset Plan'}
            </button>
            <button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-600/20 border-b border-red-600/30">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="p-4 sm:p-6">
        {!recommendations ? (
          <div className="text-center py-6">
            <p className="text-zinc-400 mb-4">
              No AI analysis yet. Complete a few workouts, then run an analysis to get personalized recommendations.
            </p>
            <p className="text-sm text-zinc-500">
              The AI will review your workout history and suggest adjustments for progression and back safety.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Warnings */}
            {recommendations.warnings && recommendations.warnings.length > 0 && (
              <div className="bg-yellow-600/20 border border-yellow-600/30 rounded-lg p-4">
                <h3 className="text-sm font-medium text-yellow-400 mb-2">Warnings</h3>
                <ul className="space-y-1">
                  {recommendations.warnings.map((warning, idx) => (
                    <li key={idx} className="text-sm text-yellow-200">{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Deload Alert */}
            {recommendations.deload_recommended && (
              <div className="bg-orange-600/20 border border-orange-600/30 rounded-lg p-4">
                <h3 className="text-sm font-medium text-orange-400 mb-1">Deload Recommended</h3>
                <p className="text-sm text-orange-200">{recommendations.deload_reason}</p>
              </div>
            )}

            {/* Progression Notes */}
            {recommendations.progression_notes && recommendations.progression_notes.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-zinc-300 mb-2">Progression Notes</h3>
                <ul className="space-y-1">
                  {recommendations.progression_notes.map((note, idx) => (
                    <li key={idx} className="text-sm text-zinc-400 flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">•</span>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Toggle Details */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>

            {showDetails && (
              <div className="space-y-4 pt-2">
                {/* Weight Adjustments */}
                {recommendations.weight_adjustments && recommendations.weight_adjustments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-zinc-300 mb-2">Weight Adjustments</h3>
                    <div className="space-y-2">
                      {recommendations.weight_adjustments.map((adj, idx) => (
                        <div key={idx} className="bg-zinc-800 rounded-lg p-3">
                          <p className="font-medium text-white text-sm">{adj.exercise_name}</p>
                          <p className="text-xs text-zinc-400 mt-1">
                            {adj.current_weight || 'BW'}lbs → <span className="text-green-400">{adj.suggested_weight || 'BW'}lbs</span>
                          </p>
                          <p className="text-xs text-zinc-500 mt-1">{adj.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Exercise Swaps */}
                {recommendations.exercise_swaps && recommendations.exercise_swaps.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-zinc-300 mb-2">Exercise Swaps (Back Safety)</h3>
                    <div className="space-y-2">
                      {recommendations.exercise_swaps.map((swap, idx) => (
                        <div key={idx} className="bg-orange-600/10 border border-orange-600/30 rounded-lg p-3">
                          <p className="text-sm text-zinc-400">
                            <span className="text-red-400 line-through">{swap.original_exercise}</span>
                            {' → '}
                            <span className="text-green-400 font-medium">{swap.replacement_exercise}</span>
                          </p>
                          <p className="text-xs text-zinc-400 mt-1">
                            {swap.sets}x{swap.reps_min}-{swap.reps_max} @ {swap.weight || 'BW'}lbs
                          </p>
                          <p className="text-xs text-orange-300 mt-1">{swap.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Exercises to Add */}
                {recommendations.exercises_to_add && recommendations.exercises_to_add.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-zinc-300 mb-2">Suggested Additions</h3>
                    <div className="space-y-2">
                      {recommendations.exercises_to_add.map((ex, idx) => (
                        <div key={idx} className="bg-green-600/10 border border-green-600/30 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-white text-sm">{ex.name}</p>
                            <span className="text-xs text-zinc-400">{ex.day_type}</span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-1">
                            {ex.sets}x{ex.reps_min}-{ex.reps_max} @ {ex.weight || 'BW'}lbs
                          </p>
                          <p className="text-xs text-green-400 mt-1">{ex.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cardio Adjustments */}
                {recommendations.cardio_adjustments && (
                  <div>
                    <h3 className="text-sm font-medium text-zinc-300 mb-2">Cardio Adjustments</h3>
                    <div className="bg-blue-600/10 border border-blue-600/30 rounded-lg p-3">
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <p className="text-zinc-500">Duration</p>
                          <p className="text-zinc-400">
                            {recommendations.cardio_adjustments.current_duration} → <span className="text-blue-400">{recommendations.cardio_adjustments.suggested_duration}</span> min
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-500">Incline</p>
                          <p className="text-zinc-400">
                            {recommendations.cardio_adjustments.current_incline} → <span className="text-blue-400">{recommendations.cardio_adjustments.suggested_incline}</span>%
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-500">Speed</p>
                          <p className="text-zinc-400">
                            {recommendations.cardio_adjustments.current_speed} → <span className="text-blue-400">{recommendations.cardio_adjustments.suggested_speed}</span> mph
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-blue-300 mt-2">{recommendations.cardio_adjustments.reason}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
