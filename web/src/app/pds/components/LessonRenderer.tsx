'use client'

import { useState, useEffect, useCallback } from 'react'
import { Lesson, Module, ContentBlock, ProgressData, LessonProgress } from '@/lib/pds/types'
import {
  loadProgress,
  saveProgress,
  setLessonCompleted,
  saveQuizAnswer,
  saveQuickCheckAnswer,
  markFlashcardViewed,
  saveMemo,
  getLessonProgress,
  getMemo,
} from '@/lib/pds/progress-store'
import { getNextLesson, getPreviousLesson } from '@/lib/pds/content'
import Link from 'next/link'

import TextBlock from './TextBlock'
import MultipleChoiceQuiz from './MultipleChoiceQuiz'
import QuickCheck from './QuickCheck'
import Flashcards from './Flashcards'
import MicroSim from './MicroSim'
import MemoPanel from './MemoPanel'

type Props = {
  module: Module
  lesson: Lesson
}

export default function LessonRenderer({ module, lesson }: Props) {
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [lessonProgress, setLessonProgress] = useState<LessonProgress | null>(null)

  // Load progress on mount
  useEffect(() => {
    const loaded = loadProgress()
    setProgress(loaded)
    setLessonProgress(getLessonProgress(loaded, module.slug, lesson.slug))
  }, [module.slug, lesson.slug])

  const updateProgress = useCallback((newProgress: ProgressData) => {
    setProgress(newProgress)
    setLessonProgress(getLessonProgress(newProgress, module.slug, lesson.slug))
    saveProgress(newProgress)
  }, [module.slug, lesson.slug])

  const handleQuizAnswer = useCallback((quizId: string, selectedOptionIds: string[], isCorrect: boolean) => {
    if (!progress) return
    const updated = saveQuizAnswer(progress, module.slug, lesson.slug, quizId, selectedOptionIds, isCorrect)
    updateProgress(updated)
  }, [progress, module.slug, lesson.slug, updateProgress])

  const handleQuickCheckAnswer = useCallback((checkId: string, selectedAnswer: boolean, isCorrect: boolean) => {
    if (!progress) return
    const updated = saveQuickCheckAnswer(progress, module.slug, lesson.slug, checkId, selectedAnswer, isCorrect)
    updateProgress(updated)
  }, [progress, module.slug, lesson.slug, updateProgress])

  const handleFlashcardViewed = useCallback((cardIndex: number) => {
    if (!progress) return
    const updated = markFlashcardViewed(progress, module.slug, lesson.slug, cardIndex)
    updateProgress(updated)
  }, [progress, module.slug, lesson.slug, updateProgress])

  const handleMemoSave = useCallback((memoId: string, content: string) => {
    if (!progress) return
    const updated = saveMemo(progress, module.slug, lesson.slug, memoId, content)
    updateProgress(updated)
  }, [progress, module.slug, lesson.slug, updateProgress])

  const handleMarkComplete = useCallback(() => {
    if (!progress) return
    const updated = setLessonCompleted(progress, module.slug, lesson.slug)
    updateProgress(updated)
  }, [progress, module.slug, lesson.slug, updateProgress])

  const renderBlock = (block: ContentBlock, index: number) => {
    switch (block.type) {
      case 'text':
        return <TextBlock key={index} block={block} />

      case 'quiz':
        return (
          <MultipleChoiceQuiz
            key={block.id}
            quiz={block}
            existingAnswer={lessonProgress?.quizAnswers[block.id]}
            onAnswer={(ids, correct) => handleQuizAnswer(block.id, ids, correct)}
          />
        )

      case 'quickcheck':
        return (
          <QuickCheck
            key={block.id}
            check={block}
            existingAnswer={lessonProgress?.quickCheckAnswers[block.id]}
            onAnswer={(ans, correct) => handleQuickCheckAnswer(block.id, ans, correct)}
          />
        )

      case 'flashcards':
        return (
          <Flashcards
            key={block.id}
            block={block}
            viewedCards={lessonProgress?.flashcardsViewed}
            onCardViewed={handleFlashcardViewed}
          />
        )

      case 'microsim':
        return <MicroSim key={block.id} block={block} />

      case 'memo':
        return (
          <MemoPanel
            key={block.id}
            block={block}
            existingMemo={progress ? getMemo(progress, module.slug, lesson.slug, block.id) : null}
            onSave={(content) => handleMemoSave(block.id, content)}
          />
        )

      default:
        return null
    }
  }

  const nextLesson = getNextLesson(module.slug, lesson.slug)
  const prevLesson = getPreviousLesson(module.slug, lesson.slug)
  const isCompleted = lessonProgress?.completed

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
        <Link href="/pds" className="hover:text-white transition-colors">PDS</Link>
        <span>/</span>
        <Link href={`/pds/modules/${module.slug}`} className="hover:text-white transition-colors">
          {module.title}
        </Link>
        <span>/</span>
        <span className="text-zinc-300">{lesson.title}</span>
      </nav>

      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          {isCompleted && (
            <span className="px-2 py-0.5 bg-green-600/20 text-green-400 text-xs font-medium rounded-full">
              ✓ Completed
            </span>
          )}
          <span className="text-xs text-zinc-500">{lesson.estimatedMinutes} min</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          {lesson.title}
        </h1>
        <p className="text-zinc-400">{lesson.description}</p>
      </header>

      {/* Content Blocks */}
      <div className="space-y-6">
        {lesson.blocks.map((block, index) => renderBlock(block, index))}
      </div>

      {/* Completion & Navigation */}
      <div className="mt-10 pt-8 border-t border-zinc-800">
        {!isCompleted && (
          <button
            onClick={handleMarkComplete}
            className="w-full py-3 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors mb-6"
          >
            Mark Lesson Complete
          </button>
        )}

        <div className="flex items-center justify-between">
          {prevLesson ? (
            <Link
              href={`/pds/modules/${prevLesson.module.slug}/${prevLesson.lesson.slug}`}
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
            >
              <span>←</span>
              <div className="text-left">
                <p className="text-xs text-zinc-500">Previous</p>
                <p className="text-sm">{prevLesson.lesson.title}</p>
              </div>
            </Link>
          ) : (
            <div />
          )}

          {nextLesson ? (
            <Link
              href={`/pds/modules/${nextLesson.module.slug}/${nextLesson.lesson.slug}`}
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
            >
              <div className="text-right">
                <p className="text-xs text-zinc-500">Next</p>
                <p className="text-sm">{nextLesson.lesson.title}</p>
              </div>
              <span>→</span>
            </Link>
          ) : (
            <Link
              href="/pds/modules"
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <span>Back to Modules →</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
