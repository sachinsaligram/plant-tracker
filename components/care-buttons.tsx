'use client'
import { useState } from 'react'

type Props = { plantId: string; onLogged?: () => void }

const BUTTONS = [
  { type: 'water', label: '💧 Water' },
  { type: 'repot', label: '🪴 Repot' },
  { type: 'fertilize', label: '🌱 Fertilize' },
] as const

export function CareButtons({ plantId, onLogged }: Props) {
  const [loading, setLoading] = useState<string | null>(null)

  async function log(type: 'water' | 'repot' | 'fertilize') {
    setLoading(type)
    await fetch('/api/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant_id: plantId, type }),
    })
    setLoading(null)
    onLogged?.()
  }

  return (
    <div className="flex gap-3">
      {BUTTONS.map(({ type, label }) => (
        <button
          key={type}
          onClick={() => log(type)}
          disabled={loading === type}
          className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-sm font-medium hover:bg-green-50 disabled:opacity-50"
        >
          {loading === type ? '...' : label}
        </button>
      ))}
    </div>
  )
}
