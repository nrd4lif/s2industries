'use client'

import { useState, useEffect } from 'react'
import { QuickCheckBlock } from '@/lib/pds/types'
import { ZapIcon, CheckIcon, XIcon } from './Icons'

type Props = {
  check: QuickCheckBlock
  existingAnswer?: { selectedAnswer: boolean; isCorrect: boolean }
  onAnswer: (selectedAnswer: boolean, isCorrect: boolean) => void
}

export default function QuickCheck({ check, existingAnswer, onAnswer }: Props) {
  const [selected, setSelected] = useState<boolean | null>(
    existingAnswer?.selectedAnswer ?? null
  )
  const [submitted, setSubmitted] = useState(!!existingAnswer)

  useEffect(() => {
    if (existingAnswer) {
      setSelected(existingAnswer.selectedAnswer)
      setSubmitted(true)
    } else {
      setSelected(null)
      setSubmitted(false)
    }
  }, [check.id, existingAnswer])

  const handleSelect = (value: boolean) => {
    if (submitted) return
    setSelected(value)
  }

  const handleSubmit = () => {
    if (selected === null) return

    const isCorrect = selected === check.isTrue
    setSubmitted(true)
    onAnswer(selected, isCorrect)
  }

  const getButtonStyle = (value: boolean) => {
    const isSelected = selected === value
    const base = 'flex-1 py-3 px-4 rounded-lg border-2 font-medium text-sm transition-all'

    if (!submitted) {
      return `${base} ${
        isSelected
          ? 'border-blue-500 bg-blue-500/10 text-blue-400'
          : 'border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200'
      }`
    }

    // After submission
    const isCorrectAnswer = value === check.isTrue
    if (isCorrectAnswer) {
      return `${base} border-green-500 bg-green-500/10 text-green-400`
    }
    if (isSelected && !isCorrectAnswer) {
      return `${base} border-red-500 bg-red-500/10 text-red-400`
    }
    return `${base} border-zinc-700 text-zinc-600 opacity-50`
  }

  const wasCorrect = existingAnswer?.isCorrect ?? (submitted && selected === check.isTrue)

  return (
    <div className="bg-zinc-900/50 rounded-xl p-5 border border-zinc-800">
      <div className="flex items-start gap-3 mb-4">
        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
          <ZapIcon size={16} />
        </span>
        <div>
          <p className="text-xs text-purple-400 font-medium mb-1">Quick Check</p>
          <p className="text-white">{check.statement}</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <button
          onClick={() => handleSelect(true)}
          disabled={submitted}
          className={getButtonStyle(true)}
        >
          True
        </button>
        <button
          onClick={() => handleSelect(false)}
          disabled={submitted}
          className={getButtonStyle(false)}
        >
          False
        </button>
      </div>

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={selected === null}
          className="w-full py-2.5 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          Check
        </button>
      )}

      {submitted && (
        <div
          className={`p-4 rounded-lg ${
            wasCorrect ? 'bg-green-900/20 border border-green-800' : 'bg-amber-900/20 border border-amber-800'
          }`}
        >
          <div className={`flex items-center gap-1.5 text-sm font-medium mb-1 ${wasCorrect ? 'text-green-400' : 'text-amber-400'}`}>
            {wasCorrect ? <CheckIcon size={14} /> : <XIcon size={14} />}
            <span>{wasCorrect ? 'Correct!' : 'Not quite'}</span>
          </div>
          {check.explanation && (
            <p className="text-sm text-zinc-300">{check.explanation}</p>
          )}
        </div>
      )}
    </div>
  )
}
