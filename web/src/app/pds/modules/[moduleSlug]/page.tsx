'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getModule } from '@/lib/pds/content'
import { ProgressData } from '@/lib/pds/types'
import { loadProgress, getLessonProgress, getLessonQuizScore } from '@/lib/pds/progress-store'

type Props = {
  params: Promise<{ moduleSlug: string }>
}

export default function ModulePage({ params }: Props) {
  const { moduleSlug } = use(params)
  const currentModule = getModule(moduleSlug)

  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setProgress(loadProgress())
  }, [])

  if (!currentModule) {
    notFound()
  }

  const completedCount = mounted && progress
    ? currentModule.lessons.filter(l => progress.lessonProgress[`${currentModule.slug}/${l.slug}`]?.completed).length
    : 0

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
        <Link href="/pds" className="hover:text-white transition-colors">PDS</Link>
        <span>/</span>
        <Link href="/pds/modules" className="hover:text-white transition-colors">Modules</Link>
        <span>/</span>
        <span className="text-zinc-300">{currentModule.title}</span>
      </nav>

      {/* Module Header */}
      <header className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center text-3xl">
            {currentModule.icon}
          </div>
          <div>
            <span className="text-sm text-blue-400">{currentModule.weekRange}</span>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{currentModule.title}</h1>
          </div>
        </div>
        <p className="text-zinc-400 text-lg">{currentModule.description}</p>

        {/* Progress */}
        {currentModule.lessons.length > 0 && (
          <div className="mt-6 bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-zinc-400">Module Progress</span>
              <span className="text-white font-medium">
                {mounted ? `${completedCount} of ${currentModule.lessons.length} lessons` : '...'}
              </span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-600 transition-all duration-500"
                style={{ width: mounted ? `${(completedCount / currentModule.lessons.length) * 100}%` : '0%' }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Lessons List */}
      {currentModule.lessons.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white mb-4">Lessons</h2>
          {currentModule.lessons.map((lesson, index) => {
            const lessonProg = mounted && progress
              ? getLessonProgress(progress, currentModule.slug, lesson.slug)
              : null
            const isCompleted = lessonProg?.completed
            const quizScore = lessonProg ? getLessonQuizScore(lessonProg) : null

            return (
              <Link
                key={lesson.slug}
                href={`/pds/modules/${currentModule.slug}/${lesson.slug}`}
                className="block bg-zinc-900/50 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      isCompleted
                        ? 'bg-green-600/20 text-green-400'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {isCompleted ? '✓' : index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-white">{lesson.title}</h3>
                        {isCompleted && (
                          <span className="text-xs text-green-400 bg-green-600/10 px-2 py-0.5 rounded-full">
                            Complete
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-400 mb-3">{lesson.description}</p>

                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <span>⏱</span>
                          {lesson.estimatedMinutes} min
                        </span>
                        <span className="flex items-center gap-1">
                          <span>📄</span>
                          {lesson.blocks.length} blocks
                        </span>
                        {quizScore && quizScore.total > 0 && (
                          <span className={`flex items-center gap-1 ${
                            quizScore.percentage >= 80 ? 'text-green-400' : 'text-amber-400'
                          }`}>
                            <span>📝</span>
                            {quizScore.correct}/{quizScore.total} quiz score
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-zinc-600 text-lg">→</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-8 text-center">
          <span className="text-4xl mb-4 block">🚧</span>
          <h3 className="text-lg font-semibold text-white mb-2">Coming Soon</h3>
          <p className="text-zinc-400">
            Lessons for this module are being developed. Check back soon!
          </p>
        </div>
      )}
    </div>
  )
}
