'use client'

import { useState } from 'react'
import PriceChart from '../../components/PriceChart'

interface ChartButtonProps {
  tokenMint: string
  tokenSymbol: string
}

export default function ChartButton({ tokenMint, tokenSymbol }: ChartButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded transition-colors text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4v16" />
        </svg>
        View Chart
      </button>

      <PriceChart
        tokenMint={tokenMint}
        tokenSymbol={tokenSymbol}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  )
}
