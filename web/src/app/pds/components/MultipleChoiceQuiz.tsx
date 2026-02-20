'use client'

import { useState, useEffect } from 'react'
import { QuizBlock, QuizOption } from '@/lib/pds/types'

type Props = {
  quiz: QuizBlock
  existingAnswer?: { selectedOptionIds: string[]; isCorrect: boolean }
  onAnswer: (selectedOptionIds: string[], isCorrect: boolean) => void
}

export default function MultipleChoiceQuiz({ quiz, existingAnswer, onAnswer }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(existingAnswer?.selectedOptionIds || [])
  )
  const [submitted, setSubmitted] = useState(!!existingAnswer)
  const [showExplanation, setShowExplanation] = useState(!!existingAnswer)

  // Reset state when quiz changes
  useEffect(() => {
    if (existingAnswer) {
      setSelectedIds(new Set(existingAnswer.selectedOptionIds))
      setSubmitted(true)
      setShowExplanation(true)
    } else {
      setSelectedIds(new Set())
      setSubmitted(false)
      setShowExplanation(false)
    }
  }, [quiz.id, existingAnswer])

  const handleSelect = (optionId: string) => {
    if (submitted) return

    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (quiz.multiSelect) {
        if (newSet.has(optionId)) {
          newSet.delete(optionId)
        } else {
          newSet.add(optionId)
        }
      } else {
        newSet.clear()
        newSet.add(optionId)
      }
      return newSet
    })
  }

  const handleSubmit = () => {
    if (selectedIds.size === 0) return

    const selectedArray = Array.from(selectedIds)
    const correctIds = quiz.options.filter(o => o.isCorrect).map(o => o.id)
    const isCorrect =
      selectedArray.length === correctIds.length &&
      selectedArray.every(id => correctIds.includes(id))

    setSubmitted(true)
    setShowExplanation(true)
    onAnswer(selectedArray, isCorrect)
  }

  const getOptionStyle = (option: QuizOption) => {
    const isSelected = selectedIds.has(option.id)
    const base = 'p-4 rounded-lg border-2 transition-all cursor-pointer text-left w-full'

    if (!submitted) {
      return `${base} ${
        isSelected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/50'
      }`
    }

    // After submission
    if (option.isCorrect) {
      return `${base} border-green-500 bg-green-500/10`
    }
    if (isSelected && !option.isCorrect) {
      return `${base} border-red-500 bg-red-500/10`
    }
    return `${base} border-zinc-700 bg-zinc-800/30 opacity-50`
  }

  const wasCorrect = existingAnswer?.isCorrect ??
    (submitted && Array.from(selectedIds).length > 0 &&
     Array.from(selectedIds).every(id => quiz.options.find(o => o.id === id)?.isCorrect) &&
     quiz.options.filter(o => o.isCorrect).every(o => selectedIds.has(o.id)))

  return (
    <div className="bg-zinc-900/50 rounded-xl p-5 border border-zinc-800">
      <div className="flex items-start gap-3 mb-4">
        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-medium">
          ?
        </span>
        <div>
          <p className="text-white font-medium">{quiz.question}</p>
          {quiz.multiSelect && (
            <p className="text-xs text-zinc-500 mt-1">Select all that apply</p>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {quiz.options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleSelect(option.id)}
            disabled={submitted}
            className={getOptionStyle(option)}
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${
                  selectedIds.has(option.id)
                    ? 'border-current bg-current/20'
                    : 'border-zinc-600'
                }`}
              >
                {submitted && option.isCorrect && '✓'}
                {submitted && selectedIds.has(option.id) && !option.isCorrect && '✗'}
              </span>
              <span className="text-sm text-zinc-200">{option.text}</span>
            </div>
          </button>
        ))}
      </div>

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={selectedIds.size === 0}
          className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          Check Answer
        </button>
      )}

      {showExplanation && (
        <div
          className={`mt-4 p-4 rounded-lg ${
            wasCorrect ? 'bg-green-900/20 border border-green-800' : 'bg-amber-900/20 border border-amber-800'
          }`}
        >
          <p className={`text-sm font-medium mb-1 ${wasCorrect ? 'text-green-400' : 'text-amber-400'}`}>
            {wasCorrect ? '✓ Correct!' : '✗ Not quite'}
          </p>
          {quiz.explanation && (
            <p className="text-sm text-zinc-300">{quiz.explanation}</p>
          )}
        </div>
      )}
    </div>
  )
}
