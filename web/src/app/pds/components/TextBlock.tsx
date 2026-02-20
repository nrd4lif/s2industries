'use client'

import { TextBlock as TextBlockType } from '@/lib/pds/types'

type Props = {
  block: TextBlockType
}

// Simple markdown-like parser
function parseContent(content: string): React.ReactNode[] {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let inCodeBlock = false
  let codeContent: string[] = []
  let listItems: string[] = []
  let tableLines: string[] = []
  let inTable = false

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="space-y-1.5 my-3 ml-4">
          {listItems.map((item, i) => (
            <li key={i} className="text-zinc-300 text-sm flex items-start gap-2">
              <span className="text-zinc-500 mt-1.5">•</span>
              <span>{parseInline(item)}</span>
            </li>
          ))}
        </ul>
      )
      listItems = []
    }
  }

  const flushTable = () => {
    if (tableLines.length >= 2) {
      const headers = tableLines[0].split('|').filter(c => c.trim()).map(c => c.trim())
      const rows = tableLines.slice(2).map(line =>
        line.split('|').filter(c => c.trim()).map(c => c.trim())
      )

      elements.push(
        <div key={`table-${elements.length}`} className="overflow-x-auto my-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700">
                {headers.map((h, i) => (
                  <th key={i} className="text-left py-2 px-3 text-zinc-400 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-zinc-800">
                  {row.map((cell, j) => (
                    <td key={j} className="py-2 px-3 text-zinc-300">
                      {parseInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    tableLines = []
    inTable = false
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code block handling
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${elements.length}`} className="bg-zinc-800 rounded-lg p-4 my-3 overflow-x-auto">
            <code className="text-sm text-zinc-300 font-mono">{codeContent.join('\n')}</code>
          </pre>
        )
        codeContent = []
        inCodeBlock = false
      } else {
        flushList()
        flushTable()
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeContent.push(line)
      continue
    }

    // Table handling
    if (line.includes('|') && line.trim().startsWith('|')) {
      flushList()
      tableLines.push(line)
      inTable = true
      continue
    } else if (inTable) {
      flushTable()
    }

    // Headers
    if (line.startsWith('## ')) {
      flushList()
      elements.push(
        <h2 key={`h2-${elements.length}`} className="text-xl font-bold text-white mt-6 mb-3">
          {line.slice(3)}
        </h2>
      )
      continue
    }

    if (line.startsWith('### ')) {
      flushList()
      elements.push(
        <h3 key={`h3-${elements.length}`} className="text-lg font-semibold text-white mt-5 mb-2">
          {line.slice(4)}
        </h3>
      )
      continue
    }

    // List items
    if (line.startsWith('- ')) {
      listItems.push(line.slice(2))
      continue
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^\d+\.\s(.*)$/)
      if (match) {
        listItems.push(match[1])
      }
      continue
    }

    // Empty line
    if (line.trim() === '') {
      flushList()
      continue
    }

    // Regular paragraph
    flushList()
    elements.push(
      <p key={`p-${elements.length}`} className="text-zinc-300 text-sm leading-relaxed my-3">
        {parseInline(line)}
      </p>
    )
  }

  flushList()
  flushTable()

  return elements
}

// Parse inline formatting
function parseInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let remaining = text
  let keyIndex = 0

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/)
    if (boldMatch) {
      parts.push(<strong key={keyIndex++} className="text-white font-medium">{boldMatch[1]}</strong>)
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    // Inline code
    const codeMatch = remaining.match(/^`(.+?)`/)
    if (codeMatch) {
      parts.push(
        <code key={keyIndex++} className="px-1.5 py-0.5 bg-zinc-800 rounded text-blue-400 text-xs font-mono">
          {codeMatch[1]}
        </code>
      )
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    // Subscripts like H₀
    const subMatch = remaining.match(/^([A-Za-z])₀/)
    if (subMatch) {
      parts.push(
        <span key={keyIndex++}>
          {subMatch[1]}<sub>0</sub>
        </span>
      )
      remaining = remaining.slice(subMatch[0].length)
      continue
    }

    // Regular character
    const nextSpecial = remaining.search(/\*\*|`|[A-Za-z]₀/)
    if (nextSpecial === -1) {
      parts.push(remaining)
      break
    } else if (nextSpecial === 0) {
      parts.push(remaining[0])
      remaining = remaining.slice(1)
    } else {
      parts.push(remaining.slice(0, nextSpecial))
      remaining = remaining.slice(nextSpecial)
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>
}

export default function TextBlock({ block }: Props) {
  return <div className="prose-zinc">{parseContent(block.content)}</div>
}
