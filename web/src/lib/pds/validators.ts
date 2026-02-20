import { z } from 'zod'

// Progress data schema matching the TypeScript types
export const progressDataSchema = z.object({
  version: z.number(),
  lessonProgress: z.record(z.string(), z.object({
    moduleSlug: z.string(),
    lessonSlug: z.string(),
    completed: z.boolean(),
    completedAt: z.number().optional(),
    quizAnswers: z.record(z.string(), z.object({
      lessonSlug: z.string(),
      quizId: z.string(),
      selectedOptionIds: z.array(z.string()),
      isCorrect: z.boolean(),
      answeredAt: z.number(),
    })),
    quickCheckAnswers: z.record(z.string(), z.object({
      lessonSlug: z.string(),
      checkId: z.string(),
      selectedAnswer: z.boolean(),
      isCorrect: z.boolean(),
      answeredAt: z.number(),
    })),
    flashcardsViewed: z.record(z.string(), z.boolean()),
    scrollPosition: z.number().optional(),
    lastVisitedAt: z.number().optional(),
  })),
  memos: z.record(z.string(), z.object({
    moduleSlug: z.string(),
    lessonSlug: z.string(),
    memoId: z.string(),
    content: z.string(),
    updatedAt: z.number(),
  })),
  streakDays: z.number(),
  lastActiveDate: z.string(),
  totalLessonsCompleted: z.number(),
  lastLessonKey: z.string().optional(),
})

export type ProgressDataInput = z.infer<typeof progressDataSchema>
