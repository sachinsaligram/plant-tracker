'use client'
import React from 'react'

function renderInline(text: string, baseKey: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    const key = `${baseKey}-${i}`
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={key}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={key}>{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={key} className="bg-black/10 rounded px-1 text-xs font-mono">{part.slice(1, -1)}</code>
    return <span key={key}>{part}</span>
  })
}

export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []
  let listType: 'ul' | 'ol' | null = null

  const flushList = (key: string) => {
    if (listItems.length === 0) return
    if (listType === 'ol') {
      elements.push(
        <ol key={key} className="list-decimal list-inside space-y-0.5 my-1 pl-1">
          {listItems.map((item, i) => <li key={i}>{renderInline(item, `${key}-li-${i}`)}</li>)}
        </ol>
      )
    } else {
      elements.push(
        <ul key={key} className="list-disc list-inside space-y-0.5 my-1 pl-1">
          {listItems.map((item, i) => <li key={i}>{renderInline(item, `${key}-li-${i}`)}</li>)}
        </ul>
      )
    }
    listItems = []
    listType = null
  }

  lines.forEach((line, i) => {
    const bulletMatch = line.match(/^[-*] (.+)/)
    const orderedMatch = line.match(/^\d+\. (.+)/)
    const headingMatch = line.match(/^(#{1,3}) (.+)/)

    if (bulletMatch) {
      if (listType === 'ol') flushList(`flush-${i}`)
      listType = 'ul'
      listItems.push(bulletMatch[1])
    } else if (orderedMatch) {
      if (listType === 'ul') flushList(`flush-${i}`)
      listType = 'ol'
      listItems.push(orderedMatch[1])
    } else {
      flushList(`flush-${i}`)
      if (line === '') {
        elements.push(<div key={i} className="h-1.5" />)
      } else if (headingMatch) {
        const level = headingMatch[1].length
        elements.push(
          <p key={i} className={`font-semibold mt-2 ${level === 1 ? 'text-base' : 'text-sm'}`}>
            {renderInline(headingMatch[2], `h-${i}`)}
          </p>
        )
      } else {
        elements.push(
          <p key={i} className="leading-relaxed">
            {renderInline(line, `p-${i}`)}
          </p>
        )
      }
    }
  })
  flushList('final')

  return <div className={`space-y-0.5 ${className}`}>{elements}</div>
}
