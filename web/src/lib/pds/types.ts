// Content Block Types
export type TextBlock = {
  type: 'text'
  content: string // Markdown content
}

export type QuizOption = {
  id: string
  text: string
  isCorrect: boolean
}

export type QuizBlock = {
  type: 'quiz'
  id: string
  question: string
  options: QuizOption[]
  multiSelect: boolean
  explanation?: string
}

export type QuickCheckBlock = {
  type: 'quickcheck'
  id: string
  statement: string
  isTrue: boolean
  explanation?: string
}

export type Flashcard = {
  front: string
  back: string
}

export type FlashcardsBlock = {
  type: 'flashcards'
  id: string
  cards: Flashcard[]
}

export type MicroSimBlock = {
  type: 'microsim'
  id: string
  simType: 'sampling-distribution' | 'confidence-interval' | 'power-curve'
  title: string
  description?: string
}

export type MemoBlock = {
  type: 'memo'
  id: string
  prompt: string
}

export type ContentBlock =
  | TextBlock
  | QuizBlock
  | QuickCheckBlock
  | FlashcardsBlock
  | MicroSimBlock
  | MemoBlock

// Lesson & Module Types
export type Lesson = {
  slug: string
  title: string
  description: string
  estimatedMinutes: number
  blocks: ContentBlock[]
}

export type Module = {
  slug: string
  title: string
  description: string
  weekRange: string // e.g., "Week 1-2"
  lessons: Lesson[]
}

// Progress Types
export type QuizAnswer = {
  lessonSlug: string
  quizId: string
  selectedOptionIds: string[]
  isCorrect: boolean
  answeredAt: number
}

export type QuickCheckAnswer = {
  lessonSlug: string
  checkId: string
  selectedAnswer: boolean
  isCorrect: boolean
  answeredAt: number
}

export type LessonProgress = {
  moduleSlug: string
  lessonSlug: string
  completed: boolean
  completedAt?: number
  quizAnswers: Record<string, QuizAnswer>
  quickCheckAnswers: Record<string, QuickCheckAnswer>
  flashcardsViewed: Record<string, boolean>
  scrollPosition?: number // 0-100 percentage of page scrolled
  lastVisitedAt?: number
}

export type LessonMemo = {
  moduleSlug: string
  lessonSlug: string
  memoId: string
  content: string
  updatedAt: number
}

export type ProgressData = {
  version: number
  lessonProgress: Record<string, LessonProgress> // key: `${moduleSlug}/${lessonSlug}`
  memos: Record<string, LessonMemo> // key: `${moduleSlug}/${lessonSlug}/${memoId}`
  streakDays: number
  lastActiveDate: string // ISO date string
  totalLessonsCompleted: number
  lastLessonKey?: string // key of the last lesson visited: `${moduleSlug}/${lessonSlug}`
}
