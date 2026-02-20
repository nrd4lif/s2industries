'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { modules, getTotalLessonCount } from '@/lib/pds/content'
import { ProgressData } from '@/lib/pds/types'
import {
  loadProgress,
  calculateCompletionPercentage,
} from '@/lib/pds/progress-store'

export default function ProgressPage() {
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setProgress(loadProgress())
  }, [])

  const totalLessons = getTotalLessonCount()
  const completionPct = progress ? calculateCompletionPercentage(progress, totalLessons) : 0

  // Calculate quiz stats
  const quizStats = mounted && progress ? (() => {
    let totalQuizzes = 0
    let correctQuizzes = 0

    Object.values(progress.lessonProgress).forEach(lp => {
      Object.values(lp.quizAnswers).forEach(qa => {
        totalQuizzes++
        if (qa.isCorrect) correctQuizzes++
      })
      Object.values(lp.quickCheckAnswers).forEach(qc => {
        totalQuizzes++
        if (qc.isCorrect) correctQuizzes++
      })
    })

    return { total: totalQuizzes, correct: correctQuizzes }
  })() : null

  // Get recent activity
  const recentActivity = mounted && progress ? (() => {
    const activities: Array<{
      type: 'completed' | 'quiz' | 'memo'
      moduleSlug: string
      lessonSlug: string
      timestamp: number
      details?: string
    }> = []

    // Add completed lessons
    Object.values(progress.lessonProgress).forEach(lp => {
      if (lp.completedAt) {
        activities.push({
          type: 'completed',
          moduleSlug: lp.moduleSlug,
          lessonSlug: lp.lessonSlug,
          timestamp: lp.completedAt,
        })
      }
    })

    // Add memos
    Object.values(progress.memos).forEach(memo => {
      activities.push({
        type: 'memo',
        moduleSlug: memo.moduleSlug,
        lessonSlug: memo.lessonSlug,
        timestamp: memo.updatedAt,
      })
    })

    // Sort by timestamp, most recent first
    activities.sort((a, b) => b.timestamp - a.timestamp)

    return activities.slice(0, 10)
  })() : []

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }

  const getLessonTitle = (moduleSlug: string, lessonSlug: string) => {
    const mod = modules.find(m => m.slug === moduleSlug)
    if (!mod) return lessonSlug
    const lesson = mod.lessons.find(l => l.slug === lessonSlug)
    return lesson?.title || lessonSlug
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-4">
          <Link href="/pds" className="hover:text-white transition-colors">PDS</Link>
          <span>/</span>
          <span className="text-zinc-300">Progress</span>
        </nav>
        <h1 className="text-3xl font-bold text-white mb-2">Your Progress</h1>
        <p className="text-zinc-400">Track your learning journey and achievements</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5">
          <p className="text-xs text-zinc-500 mb-1">Completion</p>
          <p className="text-3xl font-bold text-white">{mounted ? completionPct : 0}%</p>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: mounted ? `${completionPct}%` : '0%' }}
            />
          </div>
        </div>

        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5">
          <p className="text-xs text-zinc-500 mb-1">Lessons Complete</p>
          <p className="text-3xl font-bold text-white">
            {mounted ? progress?.totalLessonsCompleted || 0 : '-'}
          </p>
          <p className="text-xs text-zinc-600 mt-2">of {totalLessons} total</p>
        </div>

        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5">
          <p className="text-xs text-zinc-500 mb-1">Day Streak</p>
          <p className="text-3xl font-bold text-amber-400">
            {mounted ? progress?.streakDays || 0 : '-'}
          </p>
          <p className="text-xs text-zinc-600 mt-2">
            {mounted && progress?.lastActiveDate
              ? `Last active: ${progress.lastActiveDate}`
              : 'Start learning!'}
          </p>
        </div>

        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5">
          <p className="text-xs text-zinc-500 mb-1">Quiz Accuracy</p>
          <p className="text-3xl font-bold text-green-400">
            {mounted && quizStats && quizStats.total > 0
              ? `${Math.round((quizStats.correct / quizStats.total) * 100)}%`
              : '-'}
          </p>
          <p className="text-xs text-zinc-600 mt-2">
            {mounted && quizStats
              ? `${quizStats.correct}/${quizStats.total} correct`
              : 'No quizzes yet'}
          </p>
        </div>
      </div>

      {/* Module Progress */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Module Progress</h2>
        <div className="space-y-3">
          {modules.filter(m => m.lessons.length > 0).map((mod) => {
            const lessonCount = mod.lessons.length
            const completedCount = mounted && progress
              ? mod.lessons.filter(l => progress.lessonProgress[`${mod.slug}/${l.slug}`]?.completed).length
              : 0
            const pct = Math.round((completedCount / lessonCount) * 100)

            return (
              <Link
                key={mod.slug}
                href={`/pds/modules/${mod.slug}`}
                className="block bg-zinc-900/50 rounded-xl border border-zinc-800 hover:border-zinc-700 p-4 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{mod.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-white truncate">{mod.title}</h3>
                      <span className="text-sm text-zinc-400 ml-2">
                        {mounted ? `${completedCount}/${lessonCount}` : '-'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          pct === 100 ? 'bg-green-600' : 'bg-blue-600'
                        }`}
                        style={{ width: mounted ? `${pct}%` : '0%' }}
                      />
                    </div>
                  </div>
                  {pct === 100 && (
                    <span className="text-green-400 text-lg">✓</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
        {recentActivity.length > 0 ? (
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 divide-y divide-zinc-800">
            {recentActivity.map((activity, index) => (
              <Link
                key={`${activity.type}-${activity.moduleSlug}-${activity.lessonSlug}-${index}`}
                href={`/pds/modules/${activity.moduleSlug}/${activity.lessonSlug}`}
                className="flex items-center gap-4 p-4 hover:bg-zinc-800/50 transition-colors"
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                  activity.type === 'completed'
                    ? 'bg-green-600/20 text-green-400'
                    : activity.type === 'memo'
                    ? 'bg-indigo-600/20 text-indigo-400'
                    : 'bg-blue-600/20 text-blue-400'
                }`}>
                  {activity.type === 'completed' ? '✓' : activity.type === 'memo' ? '📝' : '?'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    {activity.type === 'completed' && 'Completed: '}
                    {activity.type === 'memo' && 'Wrote memo: '}
                    {getLessonTitle(activity.moduleSlug, activity.lessonSlug)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatTimestamp(activity.timestamp)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-8 text-center">
            <span className="text-4xl mb-4 block">📚</span>
            <h3 className="text-lg font-semibold text-white mb-2">No Activity Yet</h3>
            <p className="text-zinc-400 mb-4">
              Start learning to see your progress here!
            </p>
            <Link
              href="/pds/modules/foundations/sampling-variance"
              className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Start First Lesson
            </Link>
          </div>
        )}
      </section>

      {/* Reset Progress */}
      {mounted && progress && progress.totalLessonsCompleted > 0 && (
        <div className="mt-8 pt-8 border-t border-zinc-800">
          <button
            onClick={() => {
              if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
                localStorage.removeItem('pds-progress')
                setProgress(loadProgress())
              }
            }}
            className="text-sm text-zinc-600 hover:text-red-400 transition-colors"
          >
            Reset all progress
          </button>
        </div>
      )}
    </div>
  )
}
