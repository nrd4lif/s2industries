'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TradingPlan } from '@/types/database'

interface Props {
  plan: TradingPlan
}

export default function TradingPlanActions({ plan }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleActivate = async () => {
    if (!confirm('This will execute the entry trade. Continue?')) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/trading/plans/${plan.id}/activate`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to activate plan')
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate')
    }

    setLoading(false)
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this plan?')) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/trading/plans/${plan.id}/cancel`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to cancel plan')
      }

      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel')
    }

    setLoading(false)
  }

  if (plan.status === 'completed' || plan.status === 'cancelled') {
    return null
  }

  return (
    <div className="space-y-3 pt-4 border-t border-zinc-800">
      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}

      {plan.status === 'draft' && (
        <button
          onClick={handleActivate}
          disabled={loading}
          className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {loading ? 'Activating...' : 'Activate & Execute Entry Trade'}
        </button>
      )}

      {plan.status === 'active' && (
        <p className="text-sm text-zinc-400 text-center">
          Bot is monitoring this trade. Stop-loss and take-profit will execute automatically.
        </p>
      )}

      {(plan.status === 'draft' || plan.status === 'active') && (
        <button
          onClick={handleCancel}
          disabled={loading}
          className="w-full py-2 px-4 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 text-white rounded-lg transition-colors"
        >
          {plan.status === 'active' ? 'Cancel & Close Position' : 'Delete Plan'}
        </button>
      )}
    </div>
  )
}
