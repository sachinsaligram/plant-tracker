'use client'
import { useEffect, useState } from 'react'
import { Markdown } from './markdown'

export function TipsStream({ plantId }: { plantId: string }) {
  const [text, setText] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const es = new EventSource(`/api/tips/${plantId}`)
    es.onmessage = (e) => {
      if (e.data === '[DONE]') { setDone(true); es.close(); return }
      const { text: chunk } = JSON.parse(e.data)
      setText(prev => prev + chunk)
    }
    return () => es.close()
  }, [plantId])

  if (!text && !done) {
    return <p className="text-gray-500 text-sm animate-pulse">Loading tip...</p>
  }
  return (
    <div className="bg-green-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed">
      <Markdown text={text} />
    </div>
  )
}
