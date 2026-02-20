'use client'

import { useState, useEffect, useCallback } from 'react'
import { MemoBlock, LessonMemo } from '@/lib/pds/types'

type Props = {
  block: MemoBlock
  existingMemo?: LessonMemo | null
  onSave: (content: string) => void
}

export default function MemoPanel({ block, existingMemo, onSave }: Props) {
  const [content, setContent] = useState(existingMemo?.content || '')
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(
    existingMemo?.updatedAt ? new Date(existingMemo.updatedAt) : null
  )
  const [isExpanded, setIsExpanded] = useState(!!existingMemo?.content)

  // Update content when existingMemo changes
  useEffect(() => {
    setContent(existingMemo?.content || '')
    if (existingMemo?.updatedAt) {
      setLastSaved(new Date(existingMemo.updatedAt))
    }
  }, [existingMemo])

  // Auto-save with debounce
  const debouncedSave = useCallback((text: string) => {
    if (!text.trim()) return

    setIsSaving(true)
    // Simulate a small delay for UX feedback
    setTimeout(() => {
      onSave(text)
      setLastSaved(new Date())
      setIsSaving(false)
    }, 300)
  }, [onSave])

  // Debounce the save
  useEffect(() => {
    if (!content.trim() && !existingMemo?.content) return

    const timer = setTimeout(() => {
      if (content !== existingMemo?.content) {
        debouncedSave(content)
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [content, existingMemo?.content, debouncedSave])

  const formatLastSaved = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`

    return date.toLocaleDateString()
  }

  return (
    <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-sm">
            📝
          </span>
          <div className="text-left">
            <p className="text-xs text-indigo-400 font-medium">Decision Memo</p>
            <p className="text-sm text-zinc-300">{block.prompt}</p>
          </div>
        </div>
        <span className="text-zinc-500 text-lg">
          {isExpanded ? '−' : '+'}
        </span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your thoughts here... Your notes are saved locally."
            className="w-full h-32 bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <div className="flex items-center justify-between mt-2 text-xs">
            <span className="text-zinc-500">
              {content.length} characters
            </span>
            <span className={`transition-colors ${isSaving ? 'text-indigo-400' : 'text-zinc-600'}`}>
              {isSaving ? 'Saving...' : lastSaved ? `Saved ${formatLastSaved(lastSaved)}` : 'Auto-saves as you type'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
