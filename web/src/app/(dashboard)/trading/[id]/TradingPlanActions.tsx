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

  if (plan.status === 'completed' || plan.status === 'cancelled' || plan.status === 'expired') {
    return null
  }

  const isLimitOrder = plan.target_entry_price !== null

  return (
    <div className="space-y-3 pt-4 border-t border-zinc-800">
      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}

      {plan.status === 'pending' && (
        <button
          onClick={handleActivate}
          disabled={loading}
          className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {loading ? 'Activating...' : isLimitOrder ? 'Activate Limit Order' : 'Activate & Execute Entry Trade'}
        </button>
      )}

      {plan.status === 'waiting_entry' && (
        <p className="text-sm text-purple-400 text-center">
          Limit order is active. Bot is monitoring price for entry at ${plan.target_entry_price?.toFixed(8)} (±{plan.entry_threshold_percent}%).
        </p>
      )}

      {plan.status === 'active' && (
        <p className="text-sm text-zinc-400 text-center">
          Bot is monitoring this trade. Stop-loss and take-profit will execute automatically.
        </p>
      )}

      {(plan.status === 'pending' || plan.status === 'waiting_entry' || plan.status === 'active') && (
        <button
          onClick={handleCancel}
          disabled={loading}
          className="w-full py-2 px-4 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 text-white rounded-lg transition-colors"
        >
          {plan.status === 'active' ? 'Cancel & Close Position' : plan.status === 'waiting_entry' ? 'Cancel Limit Order' : 'Delete Plan'}
        </button>
      )}
    </div>
  )
}
