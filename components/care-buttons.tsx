'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = { plantId: string; onLogged?: () => void }
type CareType = 'water' | 'repot' | 'fertilize'

const ACTIONS = [
  { type: 'water' as CareType, emoji: '💧', label: 'Water' },
  { type: 'repot' as CareType, emoji: '🪴', label: 'Repot' },
  { type: 'fertilize' as CareType, emoji: '🌱', label: 'Feed' },
]

export function CareButtons({ plantId, onLogged }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<CareType | null>(null)
  const [done, setDone] = useState<CareType | null>(null)

  async function log(type: CareType) {
    setLoading(type)
    const res = await fetch('/api/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant_id: plantId, type }),
    })
    setLoading(null)
    if (res.ok) {
      setDone(type)
      setTimeout(() => setDone(null), 2500)
      router.refresh()
      onLogged?.()
    }
  }

  return (
    <div className="flex gap-2">
      {ACTIONS.map(({ type, emoji, label }) => {
        const isLoading = loading === type
        const isDone = done === type
        return (
          <button
            key={type}
            onClick={() => log(type)}
            disabled={!!loading}
            className={`flex-1 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 active:scale-95 ${
              isDone
                ? 'bg-green-500 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-700 hover:border-green-400 hover:bg-green-50'
            } disabled:opacity-60`}
          >
            {isLoading ? (
              <span className="inline-block animate-spin">⏳</span>
            ) : isDone ? (
              '✓ Done!'
            ) : (
              <>{emoji} {label}</>
            )}
          </button>
        )
      })}
    </div>
  )
}
