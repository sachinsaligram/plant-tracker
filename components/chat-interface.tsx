'use client'
import { useState, useRef, useEffect } from 'react'
import { Markdown } from './markdown'

type Message = { role: 'user' | 'assistant'; content: string }

export function ChatInterface({ plantId }: { plantId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
        try {
          assistantText += JSON.parse(data).text
          setMessages(prev => {
            const next = [...prev]
            next[next.length - 1] = { role: 'assistant', content: assistantText }
            return next
          })
        } catch {}
      }
    }
    setLoading(false)
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 mt-12 text-center">
            <span className="text-5xl">🌿</span>
            <p className="text-gray-500 text-sm leading-relaxed">
              Ask me anything about your plant — watering, sunlight, pests, or anything else!
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
              m.role === 'user'
                ? 'self-end bg-green-600 text-white rounded-br-sm'
                : 'self-start bg-white border border-gray-100 text-gray-800 shadow-sm rounded-bl-sm'
            }`}
          >
            {m.role === 'assistant' ? (
              <Markdown text={m.content} />
            ) : (
              m.content
            )}
          </div>
        ))}
        {loading && (
          <div className="self-start bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
            <span className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t bg-white px-4 py-3 flex gap-2 items-center">
        <input
          ref={inputRef}
          className="flex-1 bg-gray-100 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition-colors"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask about your plant…"
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="w-10 h-10 flex items-center justify-center bg-green-600 text-white rounded-2xl font-bold text-lg disabled:opacity-40 hover:bg-green-700 active:scale-95 transition-all flex-shrink-0"
          aria-label="Send"
        >
          ↑
        </button>
      </div>
    </div>
  )
}
