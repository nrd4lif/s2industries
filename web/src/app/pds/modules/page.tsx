'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { modules } from '@/lib/pds/content'
import { ProgressData } from '@/lib/pds/types'
import { loadProgress, fetchProgress } from '@/lib/pds/progress-store'
import {
  ChartIcon,
  FlaskIcon,
  TrendingUpIcon,
  SearchIcon,
  CpuIcon,
  MessageIcon,
  GraduationCapIcon,
  CheckIcon,
} from '../components/Icons'

// Module icons mapping
const moduleIcons: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  foundations: ChartIcon,
  experimentation: FlaskIcon,
  metrics: TrendingUpIcon,
  'causal-inference': SearchIcon,
  'ml-for-product': CpuIcon,
  communication: MessageIcon,
  'advanced-topics': GraduationCapIcon,
}

export default function ModulesPage() {
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setProgress(loadProgress())
    fetchProgress().then(setProgress)
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-4">
          <Link href="/pds" className="hover:text-white transition-colors">PDS</Link>
          <span>/</span>
          <span className="text-zinc-300">Modules</span>
        </nav>
        <h1 className="text-3xl font-bold text-white mb-2">Course Modules</h1>
        <p className="text-zinc-400">
          {modules.length} modules covering statistics, experimentation, and product analytics
        </p>
      </div>

      {/* Modules List */}
      <div className="space-y-4">
        {modules.map((mod, index) => {
          const lessonCount = mod.lessons.length
          const completedCount = mounted && progress
            ? mod.lessons.filter(l => progress.lessonProgress[`${mod.slug}/${l.slug}`]?.completed).length
            : 0
          const isAvailable = lessonCount > 0
          const ModuleIcon = moduleIcons[mod.slug] || ChartIcon

          return (
            <div
              key={mod.slug}
              className={`bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden ${
                !isAvailable ? 'opacity-60' : ''
              }`}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <ModuleIcon size={24} className="text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs text-zinc-500 font-medium">Module {index + 1}</span>
                      <span className="text-xs text-blue-400">{mod.weekRange}</span>
                      {!isAvailable && (
                        <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded">Coming soon</span>
                      )}
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-1">{mod.title}</h2>
                    <p className="text-sm text-zinc-400">{mod.description}</p>

                    {isAvailable && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-zinc-500">{lessonCount} lessons</span>
                          {mounted && completedCount > 0 && (
                            <span className="text-green-400">{completedCount} completed</span>
                          )}
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-600 transition-all"
                            style={{ width: mounted ? `${(completedCount / lessonCount) * 100}%` : '0%' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Lessons preview */}
              {isAvailable && (
                <div className="border-t border-zinc-800 bg-zinc-900/30">
                  <div className="p-4">
                    <div className="space-y-2">
                      {mod.lessons.map((lesson, lessonIndex) => {
                        const isCompleted = mounted && progress?.lessonProgress[`${mod.slug}/${lesson.slug}`]?.completed

                        return (
                          <Link
                            key={lesson.slug}
                            href={`/pds/modules/${mod.slug}/${lesson.slug}`}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors group"
                          >
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                              isCompleted
                                ? 'bg-green-600/20 text-green-400'
                                : 'bg-zinc-800 text-zinc-500 group-hover:text-zinc-300'
                            }`}>
                              {isCompleted ? <CheckIcon size={12} /> : lessonIndex + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${
                                isCompleted ? 'text-zinc-400' : 'text-zinc-200'
                              }`}>
                                {lesson.title}
                              </p>
                              <p className="text-xs text-zinc-600 truncate">{lesson.description}</p>
                            </div>
                            <span className="text-xs text-zinc-600">{lesson.estimatedMinutes} min</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
