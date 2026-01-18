'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface WalletStatsProps {
  publicKey: string
  pendingSol: number  // Total SOL in pending/waiting orders
  activeSol: number   // Total SOL in active trades
}

export default function WalletStats({ publicKey, pendingSol, activeSol }: WalletStatsProps) {
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await fetch('/api/wallet/balance')
        const data = await res.json()
        if (data.balanceSol !== undefined) {
          setBalance(data.balanceSol)
        }
      } catch {
        // Silently fail
      }
      setLoading(false)
    }

    fetchBalance()
    // Refresh every 90 seconds
    const interval = setInterval(fetchBalance, 90000)
    return () => clearInterval(interval)
  }, [])

  // Available = balance minus pending orders only
  // activeSol represents tokens already bought (SOL already spent), so don't subtract it
  const available = balance !== null ? Math.max(0, balance - pendingSol) : null

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-zinc-400">Trading Wallet</p>
          <p className="text-white font-mono text-sm">
            {publicKey.slice(0, 8)}...{publicKey.slice(-8)}
          </p>
        </div>
        <Link
          href="/settings/wallet"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          Manage
        </Link>
      </div>

      {/* Balance breakdown */}
      <div className="grid grid-cols-4 gap-4 pt-4 border-t border-zinc-800">
        <div>
          <p className="text-xs text-zinc-500 mb-1">Balance</p>
          <p className="text-lg font-semibold text-white">
            {loading ? '...' : balance !== null ? `${balance.toFixed(4)}` : '--'}
          </p>
          <p className="text-xs text-zinc-500">SOL</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 mb-1">Pending</p>
          <p className="text-lg font-semibold text-yellow-400">
            {pendingSol.toFixed(4)}
          </p>
          <p className="text-xs text-zinc-500">SOL</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 mb-1">In Trades</p>
          <p className="text-lg font-semibold text-green-400">
            {activeSol.toFixed(4)}
          </p>
          <p className="text-xs text-zinc-500">SOL</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 mb-1">Available</p>
          <p className="text-lg font-semibold text-white">
            {loading ? '...' : available !== null ? `${available.toFixed(4)}` : '--'}
          </p>
          <p className="text-xs text-zinc-500">SOL</p>
        </div>
      </div>

      {/* Allocation bar - shows total portfolio distribution */}
      {balance !== null && (
        <div className="mt-4">
          {(() => {
            const total = balance + activeSol // Total portfolio = SOL balance + token value
            if (total <= 0) return null
            const pendingPct = (pendingSol / total) * 100
            const availablePct = ((balance - pendingSol) / total) * 100
            const inTradesPct = (activeSol / total) * 100
            return (
              <>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden flex">
                  {/* Yellow = pending orders */}
                  {pendingSol > 0 && (
                    <div
                      className="bg-yellow-500 h-full"
                      style={{ width: `${pendingPct}%` }}
                      title={`Pending: ${pendingSol.toFixed(4)} SOL`}
                    />
                  )}
                  {/* Green = in trades (token value) */}
                  {activeSol > 0 && (
                    <div
                      className="bg-green-500 h-full"
                      style={{ width: `${inTradesPct}%` }}
                      title={`In Trades: ${activeSol.toFixed(4)} SOL`}
                    />
                  )}
                  {/* Gray = available SOL */}
                  <div
                    className="bg-zinc-500 h-full"
                    style={{ width: `${Math.max(0, availablePct)}%` }}
                    title={`Available: ${available?.toFixed(4)} SOL`}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-zinc-500">
                  <span>
                    In Trades: {activeSol.toFixed(4)} SOL ({inTradesPct.toFixed(1)}%)
                    {pendingSol > 0 && ` · Pending: ${pendingSol.toFixed(4)} SOL (${pendingPct.toFixed(1)}%)`}
                  </span>
                  <span>Available: {available?.toFixed(4)} SOL ({availablePct.toFixed(1)}%)</span>
                </div>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
