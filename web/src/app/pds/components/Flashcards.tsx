'use client'

import { useState, useEffect, useCallback } from 'react'
import { FlashcardsBlock } from '@/lib/pds/types'

type Props = {
  block: FlashcardsBlock
  viewedCards?: Record<string, boolean>
  onCardViewed: (cardIndex: number) => void
}

export default function Flashcards({ block, viewedCards = {}, onCardViewed }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  const totalCards = block.cards.length
  const card = block.cards[currentIndex]
  const viewedCount = Object.keys(viewedCards).length

  // Mark current card as viewed when flipped
  useEffect(() => {
    if (isFlipped && !viewedCards[currentIndex.toString()]) {
      onCardViewed(currentIndex)
    }
  }, [isFlipped, currentIndex, viewedCards, onCardViewed])

  const goToNext = useCallback(() => {
    if (currentIndex < totalCards - 1) {
      setCurrentIndex(prev => prev + 1)
      setIsFlipped(false)
    }
  }, [currentIndex, totalCards])

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
      setIsFlipped(false)
    }
  }, [currentIndex])

  const handleFlip = () => {
    setIsFlipped(prev => !prev)
  }

  // Touch handlers for swipe
  const minSwipeDistance = 50

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      goToNext()
    } else if (isRightSwipe) {
      goToPrevious()
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goToNext()
      if (e.key === 'ArrowLeft') goToPrevious()
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        handleFlip()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToNext, goToPrevious])

  return (
    <div className="bg-zinc-900/50 rounded-xl p-5 border border-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center text-sm">
            📇
          </span>
          <span className="text-sm font-medium text-zinc-400">Flashcards</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">
            {viewedCount}/{totalCards} reviewed
          </span>
          <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${(viewedCount / totalCards) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card */}
      <div
        className="relative h-48 md:h-56 mb-4 cursor-pointer perspective-1000"
        onClick={handleFlip}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={`absolute inset-0 transition-transform duration-500 transform-style-3d ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 p-6 flex flex-col items-center justify-center text-center backface-hidden"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <p className="text-xs text-zinc-500 mb-2">Question</p>
            <p className="text-lg text-white font-medium">{card.front}</p>
            <p className="text-xs text-zinc-600 mt-4">Tap to flip</p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-900/30 to-zinc-900 border border-amber-800/50 p-6 flex flex-col items-center justify-center text-center backface-hidden rotate-y-180"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)'
            }}
          >
            <p className="text-xs text-amber-500 mb-2">Answer</p>
            <p className="text-base text-zinc-200">{card.back}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={goToPrevious}
          disabled={currentIndex === 0}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← Previous
        </button>

        <div className="flex items-center gap-1.5">
          {block.cards.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentIndex(idx)
                setIsFlipped(false)
              }}
              className={`w-2 h-2 rounded-full transition-colors ${
                idx === currentIndex
                  ? 'bg-amber-500'
                  : viewedCards[idx.toString()]
                  ? 'bg-zinc-600'
                  : 'bg-zinc-800'
              }`}
            />
          ))}
        </div>

        <button
          onClick={goToNext}
          disabled={currentIndex === totalCards - 1}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
