'use client'
import { useState } from 'react'
import { Markdown } from './markdown'

export function TipsStream({ plantId }: { plantId: string }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)

  function load() {
    if (loading || started) return
    setStarted(true)
    setLoading(true)
    const es = new EventSource(`/api/tips/${plantId}`)
    es.onmessage = (e) => {
      if (e.data === '[DONE]') { setLoading(false); es.close(); return }
      try {
        const { text: chunk } = JSON.parse(e.data)
        setText(prev => prev + chunk)
      } catch {}
    }
    es.onerror = () => { setLoading(false); es.close() }
  }

  if (!started) {
    return (
      <button
        onClick={load}
        className="w-full flex items-center justify-between bg-green-50 border border-green-200 text-green-700 rounded-2xl px-4 py-3.5 text-sm font-medium hover:bg-green-100 active:scale-95 transition-all"
      >
        <span>✨ Get a care tip from Claude</span>
        <span className="text-green-400 text-base">›</span>
      </button>
    )
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-gray-700 leading-relaxed">
      <Markdown text={text} />
      {loading && !text && <span className="text-green-500 animate-pulse text-xs">Thinking…</span>}
      {loading && text && <span className="text-green-400 animate-pulse">●</span>}
    </div>
  )
}
