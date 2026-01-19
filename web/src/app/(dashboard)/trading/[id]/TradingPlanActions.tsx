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
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    amount_sol: plan.amount_sol.toString(),
    stop_loss_percent: plan.stop_loss_percent.toString(),
    take_profit_percent: plan.take_profit_percent.toString(),
    target_entry_price: plan.target_entry_price?.toString() || '',
    entry_threshold_percent: plan.entry_threshold_percent?.toString() || '1.0',
    max_wait_hours: plan.max_wait_hours?.toString() || '24',
    // Profit protection
    profit_protection_enabled: plan.profit_protection_enabled ?? true,
    profit_trigger_percent: plan.profit_trigger_percent?.toString() || '',
    giveback_allowed_percent: plan.giveback_allowed_percent?.toString() || '',
    hard_floor_percent: plan.hard_floor_percent?.toString() || '',
  })
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

  const handleSaveEdit = async () => {
    setLoading(true)
    setError(null)

    try {
      const updates: Record<string, number | boolean> = {}

      if (editForm.amount_sol !== plan.amount_sol.toString()) {
        updates.amount_sol = parseFloat(editForm.amount_sol)
      }
      if (editForm.stop_loss_percent !== plan.stop_loss_percent.toString()) {
        updates.stop_loss_percent = parseFloat(editForm.stop_loss_percent)
      }
      if (editForm.take_profit_percent !== plan.take_profit_percent.toString()) {
        updates.take_profit_percent = parseFloat(editForm.take_profit_percent)
      }
      if (editForm.target_entry_price && editForm.target_entry_price !== plan.target_entry_price?.toString()) {
        updates.target_entry_price = parseFloat(editForm.target_entry_price)
      }
      if (editForm.entry_threshold_percent !== plan.entry_threshold_percent?.toString()) {
        updates.entry_threshold_percent = parseFloat(editForm.entry_threshold_percent)
      }
      if (editForm.max_wait_hours !== plan.max_wait_hours?.toString()) {
        updates.max_wait_hours = parseFloat(editForm.max_wait_hours)
      }
      // Profit protection updates
      if (editForm.profit_protection_enabled !== (plan.profit_protection_enabled ?? true)) {
        updates.profit_protection_enabled = editForm.profit_protection_enabled
      }
      if (editForm.profit_trigger_percent && editForm.profit_trigger_percent !== plan.profit_trigger_percent?.toString()) {
        updates.profit_trigger_percent = parseFloat(editForm.profit_trigger_percent)
      }
      if (editForm.giveback_allowed_percent && editForm.giveback_allowed_percent !== plan.giveback_allowed_percent?.toString()) {
        updates.giveback_allowed_percent = parseFloat(editForm.giveback_allowed_percent)
      }
      if (editForm.hard_floor_percent && editForm.hard_floor_percent !== plan.hard_floor_percent?.toString()) {
        updates.hard_floor_percent = parseFloat(editForm.hard_floor_percent)
      }

      if (Object.keys(updates).length === 0) {
        setEditing(false)
        setLoading(false)
        return
      }

      const res = await fetch(`/api/trading/plans/${plan.id}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save changes')
      }

      setEditing(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }

    setLoading(false)
  }

  if (plan.status === 'completed' || plan.status === 'cancelled' || plan.status === 'expired') {
    return null
  }

  const isLimitOrder = plan.target_entry_price !== null
  const isActive = plan.status === 'active'
  const canEdit = plan.status === 'pending' || plan.status === 'waiting_entry' || plan.status === 'active'

  // Edit mode UI
  if (editing) {
    return (
      <div className="space-y-4 pt-4 border-t border-zinc-800">
        <h3 className="text-sm font-medium text-white">
          {isActive ? 'Edit Active Trade' : 'Edit Order'}
        </h3>

        {isActive && (
          <p className="text-xs text-zinc-500">
            Only exit parameters can be modified on active trades.
          </p>
        )}

        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}

        {/* Amount - only for non-active plans */}
        {!isActive && (
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Amount (SOL)</label>
            <input
              type="number"
              value={editForm.amount_sol}
              onChange={(e) => setEditForm({ ...editForm, amount_sol: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0.01"
              step="0.01"
            />
          </div>
        )}

        {/* SL/TP - always editable */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Stop Loss (%)</label>
            <input
              type="number"
              value={editForm.stop_loss_percent}
              onChange={(e) => setEditForm({ ...editForm, stop_loss_percent: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              max="90"
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Take Profit (%)</label>
            <input
              type="number"
              value={editForm.take_profit_percent}
              onChange={(e) => setEditForm({ ...editForm, take_profit_percent: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              max="500"
              step="0.1"
            />
          </div>
        </div>

        {/* Entry params - only for non-active limit orders */}
        {!isActive && isLimitOrder && (
          <>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Target Entry Price (USD)</label>
              <input
                type="number"
                value={editForm.target_entry_price}
                onChange={(e) => setEditForm({ ...editForm, target_entry_price: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                step="0.00000001"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Threshold (%)</label>
                <input
                  type="number"
                  value={editForm.entry_threshold_percent}
                  onChange={(e) => setEditForm({ ...editForm, entry_threshold_percent: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0.1"
                  max="10"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Max Wait (hours)</label>
                <input
                  type="number"
                  value={editForm.max_wait_hours}
                  onChange={(e) => setEditForm({ ...editForm, max_wait_hours: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="168"
                  step="1"
                />
              </div>
            </div>
          </>
        )}

        {/* Profit Protection - editable for active and waiting_entry */}
        {(isActive || plan.status === 'waiting_entry') && (
          <div className="p-3 bg-zinc-800/50 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-white">Profit Protection</h4>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.profit_protection_enabled}
                  onChange={(e) => setEditForm({ ...editForm, profit_protection_enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-xs text-zinc-400">Enabled</span>
              </label>
            </div>

            {editForm.profit_protection_enabled && (
              <>
                <p className="text-xs text-zinc-500">
                  Based on {plan.token_volatility_at_entry?.toFixed(1) || '?'}% volatility at entry
                </p>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Start protecting at (% profit)
                  </label>
                  <input
                    type="number"
                    value={editForm.profit_trigger_percent}
                    onChange={(e) => setEditForm({ ...editForm, profit_trigger_percent: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="100"
                    step="0.5"
                    placeholder="e.g. 12"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      Check MACD after (% drop)
                    </label>
                    <input
                      type="number"
                      value={editForm.giveback_allowed_percent}
                      onChange={(e) => setEditForm({ ...editForm, giveback_allowed_percent: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0.5"
                      max="50"
                      step="0.5"
                      placeholder="e.g. 4"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      Hard exit after (% drop)
                    </label>
                    <input
                      type="number"
                      value={editForm.hard_floor_percent}
                      onChange={(e) => setEditForm({ ...editForm, hard_floor_percent: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0.5"
                      max="50"
                      step="0.5"
                      placeholder="e.g. 6"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSaveEdit}
            disabled={loading}
            className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg transition-colors"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={() => {
              setEditing(false)
              setError(null)
              // Reset form to original values
              setEditForm({
                amount_sol: plan.amount_sol.toString(),
                stop_loss_percent: plan.stop_loss_percent.toString(),
                take_profit_percent: plan.take_profit_percent.toString(),
                target_entry_price: plan.target_entry_price?.toString() || '',
                entry_threshold_percent: plan.entry_threshold_percent?.toString() || '1.0',
                max_wait_hours: plan.max_wait_hours?.toString() || '24',
                profit_protection_enabled: plan.profit_protection_enabled ?? true,
                profit_trigger_percent: plan.profit_trigger_percent?.toString() || '',
                giveback_allowed_percent: plan.giveback_allowed_percent?.toString() || '',
                hard_floor_percent: plan.hard_floor_percent?.toString() || '',
              })
            }}
            disabled={loading}
            className="py-2 px-4 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // Normal view
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

      {canEdit && (
        <button
          onClick={() => setEditing(true)}
          disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg transition-colors"
        >
          Edit Order
        </button>
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
