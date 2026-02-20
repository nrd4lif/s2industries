import { ProgressData, LessonProgress, LessonMemo, QuizAnswer, QuickCheckAnswer } from './types'

const STORAGE_KEY = 'pds-progress'
const CURRENT_VERSION = 1

function getDefaultProgress(): ProgressData {
  return {
    version: CURRENT_VERSION,
    lessonProgress: {},
    memos: {},
    streakDays: 0,
    lastActiveDate: '',
    totalLessonsCompleted: 0,
  }
}

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

export function loadProgress(): ProgressData {
  if (typeof window === 'undefined') {
    return getDefaultProgress()
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return getDefaultProgress()
    }

    const parsed = JSON.parse(stored) as ProgressData

    // Version migration if needed
    if (parsed.version !== CURRENT_VERSION) {
      // For now, just update version
      parsed.version = CURRENT_VERSION
    }

    return parsed
  } catch {
    return getDefaultProgress()
  }
}

export function saveProgress(progress: ProgressData): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch (e) {
    console.error('Failed to save PDS progress:', e)
  }
}

export function updateStreak(progress: ProgressData): ProgressData {
  const today = getTodayDateString()
  const lastActive = progress.lastActiveDate

  if (lastActive === today) {
    // Already active today, no change
    return progress
  }

  // Check if yesterday
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  let newStreak = progress.streakDays

  if (lastActive === yesterdayStr) {
    // Continuing streak
    newStreak += 1
  } else if (!lastActive) {
    // First day
    newStreak = 1
  } else {
    // Streak broken, reset
    newStreak = 1
  }

  return {
    ...progress,
    streakDays: newStreak,
    lastActiveDate: today,
  }
}

export function getLessonKey(moduleSlug: string, lessonSlug: string): string {
  return `${moduleSlug}/${lessonSlug}`
}

export function getMemoKey(moduleSlug: string, lessonSlug: string, memoId: string): string {
  return `${moduleSlug}/${lessonSlug}/${memoId}`
}

export function getLessonProgress(
  progress: ProgressData,
  moduleSlug: string,
  lessonSlug: string
): LessonProgress | null {
  const key = getLessonKey(moduleSlug, lessonSlug)
  return progress.lessonProgress[key] || null
}

export function setLessonCompleted(
  progress: ProgressData,
  moduleSlug: string,
  lessonSlug: string
): ProgressData {
  const key = getLessonKey(moduleSlug, lessonSlug)
  const existing = progress.lessonProgress[key]

  const wasCompleted = existing?.completed

  const updated: ProgressData = {
    ...progress,
    lessonProgress: {
      ...progress.lessonProgress,
      [key]: {
        moduleSlug,
        lessonSlug,
        completed: true,
        completedAt: Date.now(),
        quizAnswers: existing?.quizAnswers || {},
        quickCheckAnswers: existing?.quickCheckAnswers || {},
        flashcardsViewed: existing?.flashcardsViewed || {},
      },
    },
    totalLessonsCompleted: wasCompleted
      ? progress.totalLessonsCompleted
      : progress.totalLessonsCompleted + 1,
  }

  return updateStreak(updated)
}

export function saveQuizAnswer(
  progress: ProgressData,
  moduleSlug: string,
  lessonSlug: string,
  quizId: string,
  selectedOptionIds: string[],
  isCorrect: boolean
): ProgressData {
  const key = getLessonKey(moduleSlug, lessonSlug)
  const existing = progress.lessonProgress[key]

  const answer: QuizAnswer = {
    lessonSlug,
    quizId,
    selectedOptionIds,
    isCorrect,
    answeredAt: Date.now(),
  }

  return updateStreak({
    ...progress,
    lessonProgress: {
      ...progress.lessonProgress,
      [key]: {
        moduleSlug,
        lessonSlug,
        completed: existing?.completed || false,
        completedAt: existing?.completedAt,
        quizAnswers: {
          ...(existing?.quizAnswers || {}),
          [quizId]: answer,
        },
        quickCheckAnswers: existing?.quickCheckAnswers || {},
        flashcardsViewed: existing?.flashcardsViewed || {},
      },
    },
  })
}

export function saveQuickCheckAnswer(
  progress: ProgressData,
  moduleSlug: string,
  lessonSlug: string,
  checkId: string,
  selectedAnswer: boolean,
  isCorrect: boolean
): ProgressData {
  const key = getLessonKey(moduleSlug, lessonSlug)
  const existing = progress.lessonProgress[key]

  const answer: QuickCheckAnswer = {
    lessonSlug,
    checkId,
    selectedAnswer,
    isCorrect,
    answeredAt: Date.now(),
  }

  return updateStreak({
    ...progress,
    lessonProgress: {
      ...progress.lessonProgress,
      [key]: {
        moduleSlug,
        lessonSlug,
        completed: existing?.completed || false,
        completedAt: existing?.completedAt,
        quizAnswers: existing?.quizAnswers || {},
        quickCheckAnswers: {
          ...(existing?.quickCheckAnswers || {}),
          [checkId]: answer,
        },
        flashcardsViewed: existing?.flashcardsViewed || {},
      },
    },
  })
}

export function markFlashcardViewed(
  progress: ProgressData,
  moduleSlug: string,
  lessonSlug: string,
  cardIndex: number
): ProgressData {
  const key = getLessonKey(moduleSlug, lessonSlug)
  const existing = progress.lessonProgress[key]

  return {
    ...progress,
    lessonProgress: {
      ...progress.lessonProgress,
      [key]: {
        moduleSlug,
        lessonSlug,
        completed: existing?.completed || false,
        completedAt: existing?.completedAt,
        quizAnswers: existing?.quizAnswers || {},
        quickCheckAnswers: existing?.quickCheckAnswers || {},
        flashcardsViewed: {
          ...(existing?.flashcardsViewed || {}),
          [cardIndex.toString()]: true,
        },
      },
    },
  }
}

export function saveMemo(
  progress: ProgressData,
  moduleSlug: string,
  lessonSlug: string,
  memoId: string,
  content: string
): ProgressData {
  const key = getMemoKey(moduleSlug, lessonSlug, memoId)

  const memo: LessonMemo = {
    moduleSlug,
    lessonSlug,
    memoId,
    content,
    updatedAt: Date.now(),
  }

  return updateStreak({
    ...progress,
    memos: {
      ...progress.memos,
      [key]: memo,
    },
  })
}

export function getMemo(
  progress: ProgressData,
  moduleSlug: string,
  lessonSlug: string,
  memoId: string
): LessonMemo | null {
  const key = getMemoKey(moduleSlug, lessonSlug, memoId)
  return progress.memos[key] || null
}

// Calculate overall completion percentage
export function calculateCompletionPercentage(
  progress: ProgressData,
  totalLessons: number
): number {
  if (totalLessons === 0) return 0
  return Math.round((progress.totalLessonsCompleted / totalLessons) * 100)
}

// Get quiz score for a lesson
export function getLessonQuizScore(lessonProgress: LessonProgress | null): {
  correct: number
  total: number
  percentage: number
} {
  if (!lessonProgress) {
    return { correct: 0, total: 0, percentage: 0 }
  }

  const answers = Object.values(lessonProgress.quizAnswers)
  const total = answers.length
  const correct = answers.filter((a) => a.isCorrect).length

  return {
    correct,
    total,
    percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
  }
}
