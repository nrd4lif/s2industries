'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function WalletSettingsPage() {
  const [privateKey, setPrivateKey] = useState('')
  const [label, setLabel] = useState('Trading Wallet')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingWallet, setExistingWallet] = useState<{ public_key: string; label: string } | null>(null)
  const [generating, setGenerating] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check for existing wallet
    fetch('/api/wallet')
      .then(res => res.json())
      .then(data => {
        if (data.wallet) {
          setExistingWallet(data.wallet)
        }
      })
      .catch(() => {})
  }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/wallet/generate', { method: 'POST' })
      const data = await res.json()
      if (data.privateKey) {
        setPrivateKey(data.privateKey)
      }
    } catch {
      setError('Failed to generate wallet')
    }
    setGenerating(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ private_key: privateKey, label }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save wallet')
      }

      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save wallet')
    }

    setLoading(false)
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure? This will delete your trading wallet configuration.')) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/wallet', { method: 'DELETE' })
      if (res.ok) {
        setExistingWallet(null)
        router.refresh()
      }
    } catch {
      setError('Failed to delete wallet')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-white mb-6">Wallet Settings</h1>

      {existingWallet ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Current Wallet</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-zinc-400">Label</p>
              <p className="text-white">{existingWallet.label}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-400">Public Key</p>
              <p className="text-white font-mono text-sm break-all">
                {existingWallet.public_key}
              </p>
            </div>
            <div className="pt-4 border-t border-zinc-800">
              <p className="text-sm text-zinc-400 mb-3">
                Fund this wallet with SOL to start trading. Only deposit what you&apos;re willing to risk.
              </p>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-lg transition-colors"
              >
                Delete Wallet
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Setup Trading Wallet</h2>
          <p className="text-zinc-400 mb-6">
            Create a dedicated wallet for automated trading. Only fund it with SOL you&apos;re willing to risk.
          </p>

          <div className="mb-6">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 text-white rounded-lg transition-colors"
            >
              {generating ? 'Generating...' : 'Generate New Wallet'}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Private Key (Base58)
              </label>
              <input
                type="password"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter or generate a private key"
                required
              />
              <p className="text-xs text-zinc-500 mt-1">
                Your private key is encrypted before storage.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Label
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Trading Wallet"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !privateKey}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Saving...' : 'Save Wallet'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
