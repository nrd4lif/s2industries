'use client'

import Link from 'next/link'
import { ProgressData } from '@/lib/pds/types'
import { getLastLesson } from '@/lib/pds/progress-store'
import { getLesson } from '@/lib/pds/content'
import { ArrowRightIcon, BookOpenIcon } from './Icons'

type Props = {
  progress: ProgressData | null
  mounted: boolean
}

export default function ResumeBanner({ progress, mounted }: Props) {
  if (!mounted || !progress) return null

  const lastLesson = getLastLesson(progress)
  if (!lastLesson) return null

  const lessonData = getLesson(lastLesson.moduleSlug, lastLesson.lessonSlug)
  if (!lessonData) return null

  const { module, lesson } = lessonData
  const lessonProg = progress.lessonProgress[`${lastLesson.moduleSlug}/${lastLesson.lessonSlug}`]
  const isCompleted = lessonProg?.completed
  const scrollPercent = lastLesson.scrollPosition

  // Don't show if the lesson is completed and fully read
  if (isCompleted && scrollPercent >= 95) return null

  return (
    <Link
      href={`/pds/modules/${lastLesson.moduleSlug}/${lastLesson.lessonSlug}`}
      className="block bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-xl border border-blue-500/30 p-4 mb-8 hover:border-blue-500/50 transition-colors group"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center flex-shrink-0">
          <BookOpenIcon size={24} className="text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-blue-400 font-medium mb-0.5">
            {isCompleted ? 'Review where you left off' : 'Continue where you left off'}
          </p>
          <p className="text-white font-semibold truncate">{lesson.title}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-zinc-500">{module.title}</span>
            {scrollPercent > 0 && !isCompleted && (
              <>
                <span className="text-zinc-700">•</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${scrollPercent}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500">{scrollPercent}% read</span>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-blue-400 group-hover:text-blue-300 transition-colors">
          <span className="text-sm font-medium hidden sm:inline">Resume</span>
          <ArrowRightIcon size={18} />
        </div>
      </div>
    </Link>
  )
}
