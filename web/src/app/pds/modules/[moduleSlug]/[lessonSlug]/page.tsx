import { notFound } from 'next/navigation'
import { getLesson } from '@/lib/pds/content'
import LessonRenderer from '@/app/pds/components/LessonRenderer'

type Props = {
  params: Promise<{
    moduleSlug: string
    lessonSlug: string
  }>
}

export default async function LessonPage({ params }: Props) {
  const { moduleSlug, lessonSlug } = await params
  const result = getLesson(moduleSlug, lessonSlug)

  if (!result) {
    notFound()
  }

  const { module, lesson } = result

  return <LessonRenderer module={module} lesson={lesson} />
}
