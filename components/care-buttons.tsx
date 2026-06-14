'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = { plantId: string; onLogged?: () => void }
type CareType = 'water' | 'repot' | 'fertilize'

type ColorKey = 'blue' | 'amber' | 'green'

const ACTIONS: { type: CareType; emoji: string; label: string; color: ColorKey }[] = [
  { type: 'water', emoji: '💧', label: 'Watered', color: 'blue' },
  { type: 'repot', emoji: '🪴', label: 'Repotted', color: 'amber' },
  { type: 'fertilize', emoji: '🌱', label: 'Fed', color: 'green' },
]

const COLOR = {
  blue: {
    btn: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
    active: 'bg-blue-600 text-white border-blue-600',
    ring: 'focus:ring-blue-400',
    note: 'bg-blue-50 border-blue-200',
    confirm: 'bg-blue-600 hover:bg-blue-700',
  },
  amber: {
    btn: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
    active: 'bg-amber-600 text-white border-amber-600',
    ring: 'focus:ring-amber-400',
    note: 'bg-amber-50 border-amber-200',
    confirm: 'bg-amber-600 hover:bg-amber-700',
  },
  green: {
    btn: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100',
    active: 'bg-green-600 text-white border-green-600',
    ring: 'focus:ring-green-400',
    note: 'bg-green-50 border-green-200',
    confirm: 'bg-green-600 hover:bg-green-700',
  },
}

export function CareButtons({ plantId, onLogged }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<CareType | null>(null)
  const [notes, setNotes] = useState<Record<CareType, string>>({ water: '', repot: '', fertilize: '' })
  const [loading, setLoading] = useState<CareType | null>(null)
  const [done, setDone] = useState<CareType | null>(null)

  function toggle(type: CareType) {
    setExpanded(expanded === type ? null : type)
  }

  async function log(type: CareType) {
    setLoading(type)
    const res = await fetch('/api/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant_id: plantId, type, notes: notes[type] || undefined }),
    })
    setLoading(null)
    if (res.ok) {
      setDone(type)
      setExpanded(null)
      setNotes(n => ({ ...n, [type]: '' }))
      setTimeout(() => setDone(null), 3000)
      router.refresh()
      onLogged?.()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map(({ type, emoji, label, color }) => {
          const c = COLOR[color]
          const isActive = expanded === type
          const isDone = done === type
          const isLoading = loading === type
          return (
            <button
              key={type}
              onClick={() => !isDone && toggle(type)}
              disabled={!!loading}
              className={`rounded-2xl border py-3 text-sm font-semibold transition-all duration-150 active:scale-95 ${
                isDone
                  ? 'bg-gray-100 border-gray-200 text-gray-500'
                  : isActive
                  ? c.active
                  : c.btn
              } disabled:opacity-60`}
            >
              {isLoading ? (
                <span className="inline-block animate-spin text-base">⏳</span>
              ) : isDone ? (
                <span className="text-green-600">✓ {label}</span>
              ) : (
                <>{emoji} {label}</>
              )}
            </button>
          )
        })}
      </div>

      {expanded && (() => {
        const action = ACTIONS.find(a => a.type === expanded)!
        const c = COLOR[action.color]
        return (
          <div className={`rounded-2xl border p-3 flex flex-col gap-2 ${c.note}`}>
            <p className="text-xs font-medium text-gray-600">Add a note (optional)</p>
            <input
              type="text"
              autoFocus
              placeholder={`e.g. "Soil felt very dry" or "Used liquid fertilizer"`}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 w-full"
              value={notes[expanded]}
              onChange={e => setNotes(n => ({ ...n, [expanded]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && log(expanded)}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setExpanded(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => log(expanded)}
                disabled={!!loading}
                className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold ${c.confirm} disabled:opacity-50 transition-colors`}
              >
                {loading ? '…' : `Log ${action.label}`}
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
