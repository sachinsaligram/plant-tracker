'use client'
import { useState, useRef, useEffect } from 'react'

type Message = { role: 'user' | 'assistant'; content: string }

export function ChatInterface({ plantId }: { plantId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setLoading(true)

    const res = await fetch(`/api/chat/${plantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    })

    setMessages(prev => [...prev, { role: 'assistant', content: '' }])
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let assistantText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const line of decoder.decode(value).split('\n')) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') break
        assistantText += JSON.parse(data).text
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: assistantText }
          return next
        })
      }
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm text-center mt-8">Ask anything about your plant</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-xs rounded-2xl px-4 py-2 text-sm ${m.role === 'user' ? 'self-end bg-green-600 text-white' : 'self-start bg-gray-100 text-gray-800'}`}
          >
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="border-t p-4 flex gap-2">
        <input
          className="flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about your plant..."
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}
