'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { modules, getTotalLessonCount } from '@/lib/pds/content'
import { ProgressData } from '@/lib/pds/types'
import { loadProgress, calculateCompletionPercentage } from '@/lib/pds/progress-store'

// 16-week roadmap milestones
const roadmap = [
  { week: '1-2', title: 'Statistical Foundations', description: 'Sampling, variance, confidence intervals, hypothesis testing' },
  { week: '3-4', title: 'Experimentation', description: 'A/B testing design, power analysis, common pitfalls' },
  { week: '5-6', title: 'Product Metrics', description: 'Choosing KPIs, metric taxonomies, guardrails' },
  { week: '7-8', title: 'Causal Inference', description: 'Counterfactuals, regression discontinuity, diff-in-diff' },
  { week: '9-11', title: 'ML for Product', description: 'Classification, ranking, recommendation systems' },
  { week: '12-13', title: 'Communication', description: 'Data storytelling, dashboards, stakeholder management' },
  { week: '14-16', title: 'Advanced Topics', description: 'Bayesian methods, bandits, sequential testing' },
]

export default function PDSLandingPage() {
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setProgress(loadProgress())
  }, [])

  const totalLessons = getTotalLessonCount()
  const completionPct = progress ? calculateCompletionPercentage(progress, totalLessons) : 0
  const hasStarted = progress && progress.totalLessonsCompleted > 0

  // Find first incomplete lesson to continue
  const findContinueLesson = () => {
    for (const mod of modules) {
      for (const lesson of mod.lessons) {
        const key = `${mod.slug}/${lesson.slug}`
        if (!progress?.lessonProgress[key]?.completed) {
          return { module: mod, lesson }
        }
      }
    }
    return null
  }

  const continueLesson = progress ? findContinueLesson() : null

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="px-4 py-12 md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 rounded-full text-blue-400 text-sm mb-6">
            <span>📊</span>
            <span>16-Week Program</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Product Data Science
          </h1>
          <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
            Master the statistical foundations, experimentation skills, and analytical frameworks that power data-driven product decisions.
          </p>

          {mounted && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {hasStarted ? (
                <>
                  <Link
                    href={continueLesson ? `/pds/modules/${continueLesson.module.slug}/${continueLesson.lesson.slug}` : '/pds/modules'}
                    className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Continue Learning
                  </Link>
                  <Link
                    href="/pds/progress"
                    className="w-full sm:w-auto px-8 py-3 border border-zinc-700 hover:border-zinc-600 text-zinc-300 font-medium rounded-lg transition-colors"
                  >
                    View Progress
                  </Link>
                </>
              ) : (
                <Link
                  href="/pds/modules/foundations/sampling-variance"
                  className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Start Program
                </Link>
              )}
            </div>
          )}

          {/* Progress indicator */}
          {mounted && hasStarted && (
            <div className="mt-8 max-w-md mx-auto">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-zinc-500">Your Progress</span>
                <span className="text-zinc-300">{completionPct}% complete</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-600 mt-2">
                <span>{progress?.totalLessonsCompleted || 0} of {totalLessons} lessons</span>
                <span>{progress?.streakDays || 0} day streak</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* What You'll Learn */}
      <section className="px-4 py-12 bg-zinc-900/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">What You&apos;ll Learn</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: '📊', title: 'Statistics', description: 'From sampling theory to Bayesian inference—the math behind every data decision' },
              { icon: '🧪', title: 'Experimentation', description: 'Design, run, and analyze A/B tests that drive real product impact' },
              { icon: '🎯', title: 'Product Sense', description: 'Choose metrics, interpret results, and communicate findings to stakeholders' },
            ].map((item) => (
              <div key={item.title} className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-800">
                <span className="text-3xl mb-4 block">{item.icon}</span>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 16-Week Roadmap */}
      <section className="px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-2 text-center">16-Week Roadmap</h2>
          <p className="text-zinc-500 text-center mb-8">Progress at your own pace through bite-sized lessons</p>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-zinc-800 md:-translate-x-px" />

            {/* Milestones */}
            <div className="space-y-6">
              {roadmap.map((milestone, index) => (
                <div
                  key={milestone.week}
                  className={`relative flex items-start gap-6 ${
                    index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                  }`}
                >
                  {/* Dot */}
                  <div className="absolute left-4 md:left-1/2 w-3 h-3 bg-zinc-700 rounded-full border-2 border-zinc-900 -translate-x-1/2 mt-1.5" />

                  {/* Card */}
                  <div className={`ml-10 md:ml-0 md:w-5/12 ${index % 2 === 0 ? 'md:pr-8 md:text-right' : 'md:pl-8'}`}>
                    <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-800 hover:border-zinc-700 transition-colors">
                      <span className="text-xs text-blue-400 font-medium">Week {milestone.week}</span>
                      <h3 className="text-lg font-semibold text-white mt-1">{milestone.title}</h3>
                      <p className="text-sm text-zinc-500 mt-1">{milestone.description}</p>
                    </div>
                  </div>

                  {/* Spacer for alternating layout */}
                  <div className="hidden md:block md:w-5/12" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Current Modules */}
      <section className="px-4 py-12 bg-zinc-900/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-2 text-center">Course Modules</h2>
          <p className="text-zinc-500 text-center mb-8">Jump into any module—lessons unlock as you progress</p>

          <div className="grid md:grid-cols-2 gap-4">
            {modules.map((mod) => {
              const lessonCount = mod.lessons.length
              const completedCount = mounted && progress
                ? mod.lessons.filter(l => progress.lessonProgress[`${mod.slug}/${l.slug}`]?.completed).length
                : 0

              return (
                <Link
                  key={mod.slug}
                  href={lessonCount > 0 ? `/pds/modules/${mod.slug}` : '#'}
                  className={`bg-zinc-800/50 rounded-xl p-5 border border-zinc-800 hover:border-zinc-700 transition-colors ${
                    lessonCount === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-2xl">{mod.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-zinc-500">{mod.weekRange}</span>
                        {lessonCount === 0 && (
                          <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded">Coming soon</span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-white">{mod.title}</h3>
                      <p className="text-sm text-zinc-500 mt-1">{mod.description}</p>

                      {lessonCount > 0 && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-zinc-500">{lessonCount} lessons</span>
                            {mounted && <span className="text-zinc-400">{completedCount}/{lessonCount}</span>}
                          </div>
                          <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 transition-all"
                              style={{ width: mounted ? `${(completedCount / lessonCount) * 100}%` : '0%' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Ready to build your data science skills?</h2>
          <p className="text-zinc-400 mb-8">
            Start with the fundamentals and work your way up to advanced topics. Each lesson includes interactive exercises to reinforce your learning.
          </p>
          <Link
            href={hasStarted && continueLesson ? `/pds/modules/${continueLesson.module.slug}/${continueLesson.lesson.slug}` : '/pds/modules/foundations/sampling-variance'}
            className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            {hasStarted ? 'Continue Learning' : 'Start Now'}
          </Link>
        </div>
      </section>
    </div>
  )
}
