'use client'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Markdown } from './markdown'
import { TipsStream } from './tips-stream'

export type Plant = {
  id: string
  common_name: string
  scientific_name: string | null
  location: string
  soil_type: string | null
  mix_description: string | null
  watering_interval_days: number
  repotting_interval_days: number
  fertilizing_interval_days: number
  last_watered_at: string | null
  last_repotted_at: string | null
  last_fertilized_at: string | null
  next_watering_at: string | null
  next_repotting_at: string | null
  next_fertilizing_at: string | null
  notes: string | null
}

export type JournalEntry = {
  event_type: string
  date: string
  notes: string | null
  photo_url: string | null
  product_name: string | null
}

type Tab = 'timeline' | 'set-task' | 'about'
type Filter = 'all' | 'water' | 'fertilize' | 'photo' | 'repot'

const SOIL_LABELS: Record<string, string> = {
  'potting mix': 'Potting Mix',
  'cactus mix': 'Cactus Mix',
  'orchid mix': 'Orchid Mix',
  'custom': 'Custom Mix',
}
const LOC_LABELS: Record<string, string> = {
  indoor: 'Indoor', outdoor: 'Outdoor', balcony: 'Balcony', greenhouse: 'Greenhouse',
}
const LOC_EMOJI: Record<string, string> = {
  indoor: '🏠', outdoor: '🌳', balcony: '🌿', greenhouse: '🏡',
}

function fmt(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function relDay(d: string | null | undefined): string {
  if (!d) return '—'
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return `in ${diff}d`
}

function entryDay(date: string): string {
  const d = new Date(date)
  const today = new Date()
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function entryYear(date: string): string {
  return new Date(date).getFullYear().toString()
}

const EVENT_ICON: Record<string, string> = { water: '💧', repot: '🪴', fertilize: '🌱', photo: '📷' }
const EVENT_LABEL: Record<string, string> = { water: 'Watered', repot: 'Repotted', fertilize: 'Fed', photo: 'Photo' }
const FILTER_LABELS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'water', label: '💧 Water' },
  { key: 'fertilize', label: '🌱 Fertilize' },
  { key: 'photo', label: '📷 Photo' },
  { key: 'repot', label: '🪴 Repot' },
]

// ── Timeline Tab ──────────────────────────────────────────────────────────────

function TimelineTab({ journal, plantId }: { journal: JournalEntry[]; plantId: string }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({ water: '', repot: '', fertilize: '' })
  const [logging, setLogging] = useState<string | null>(null)
  const [doneType, setDoneType] = useState<string | null>(null)
  const router = useRouter()

  const filtered = filter === 'all' ? journal : journal.filter(e => e.event_type === filter)

  async function logCare(type: string) {
    setLogging(type)
    await fetch('/api/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant_id: plantId, type, notes: noteInputs[type] || undefined }),
    })
    setLogging(null)
    setDoneType(type)
    setExpanded(null)
    setNoteInputs(n => ({ ...n, [type]: '' }))
    setTimeout(() => setDoneType(null), 3000)
    router.refresh()
  }

  const CARE_TYPES = [
    { type: 'water', emoji: '💧', label: 'Water', color: 'bg-blue-500 hover:bg-blue-600' },
    { type: 'fertilize', emoji: '🌱', label: 'Feed', color: 'bg-green-600 hover:bg-green-700' },
    { type: 'repot', emoji: '🪴', label: 'Repot', color: 'bg-amber-500 hover:bg-amber-600' },
  ]

  return (
    <div className="flex flex-col">
      {/* Filter chips */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide bg-white border-b border-gray-100">
        {FILTER_LABELS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filter === f.key
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="px-4 py-4 pb-32">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📖</p>
            <p className="text-gray-500 text-sm">No entries yet. Log care to start your journal.</p>
          </div>
        ) : (
          <div>
            {filtered.map((entry, i) => (
              <div key={i} className="flex gap-3">
                {/* Date column */}
                <div className="w-14 flex-shrink-0 text-right pt-0.5">
                  <p className="text-xs font-semibold text-gray-700 leading-tight">{entryDay(entry.date)}</p>
                  <p className="text-xs text-gray-400">{entryYear(entry.date)}</p>
                </div>
                {/* Timeline connector */}
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full border-2 border-green-500 bg-white flex-shrink-0 mt-0.5 z-10" />
                  {i < filtered.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                </div>
                {/* Content */}
                <div className={`flex-1 ${i < filtered.length - 1 ? 'pb-4' : 'pb-2'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-gray-800">
                        {EVENT_ICON[entry.event_type]} {EVENT_LABEL[entry.event_type]}
                        {entry.product_name && (
                          <span className="font-normal text-gray-500"> · {entry.product_name}</span>
                        )}
                      </span>
                      {entry.notes && (
                        <p className="text-xs text-gray-500 mt-0.5 italic leading-snug">"{entry.notes}"</p>
                      )}
                      {entry.photo_url && (
                        <div className="mt-2 w-20 h-20 rounded-xl overflow-hidden bg-gray-100">
                          <Image src={entry.photo_url} alt="" width={80} height={80} className="object-cover w-full h-full" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating log care bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 z-20">
        <div className="max-w-lg mx-auto">
          {expanded ? (
            <div className="flex flex-col gap-2">
              <input
                autoFocus
                type="text"
                placeholder={`Note for ${expanded} (optional)…`}
                value={noteInputs[expanded] ?? ''}
                onChange={e => setNoteInputs(n => ({ ...n, [expanded]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && logCare(expanded)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setExpanded(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => logCare(expanded)}
                  disabled={!!logging}
                  className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                  {logging ? '…' : `Log ${expanded}`}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {CARE_TYPES.map(({ type, emoji, label, color }) => (
                <button
                  key={type}
                  onClick={() => setExpanded(type)}
                  disabled={!!logging}
                  className={`flex-1 py-2.5 rounded-2xl text-white text-sm font-semibold ${
                    doneType === type ? 'bg-gray-400' : color
                  } active:scale-95 transition-all disabled:opacity-60`}
                >
                  {doneType === type ? '✓' : `${emoji} ${label}`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Set Task Tab ──────────────────────────────────────────────────────────────

function SetTaskTab({ plant }: { plant: Plant }) {
  const router = useRouter()
  const [intervals, setIntervals] = useState({
    watering_interval_days: plant.watering_interval_days,
    repotting_interval_days: plant.repotting_interval_days,
    fertilizing_interval_days: plant.fertilizing_interval_days,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await fetch(`/api/plants/${plant.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(intervals),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  const tasks = [
    {
      type: 'water',
      emoji: '💧',
      label: 'Water',
      intervalKey: 'watering_interval_days' as const,
      lastAt: plant.last_watered_at,
      nextAt: plant.next_watering_at,
    },
    {
      type: 'fertilize',
      emoji: '🌱',
      label: 'Fertilize',
      intervalKey: 'fertilizing_interval_days' as const,
      lastAt: plant.last_fertilized_at,
      nextAt: plant.next_fertilizing_at,
    },
    {
      type: 'repot',
      emoji: '🪴',
      label: 'Repot',
      intervalKey: 'repotting_interval_days' as const,
      lastAt: plant.last_repotted_at,
      nextAt: plant.next_repotting_at,
    },
  ]

  return (
    <div className="px-4 py-4 pb-28 max-w-lg mx-auto flex flex-col gap-3">
      {tasks.map(({ emoji, label, intervalKey, lastAt, nextAt }) => (
        <div key={intervalKey} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50">
            <span className="text-2xl">{emoji}</span>
            <div className="flex-1">
              <p className="font-semibold text-gray-800 text-sm">{label}</p>
              {nextAt && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Next: {fmt(nextAt)} · {relDay(nextAt)}
                </p>
              )}
            </div>
            {/* Toggle indicator - always ON since we track all 3 */}
            <div className="w-10 h-6 bg-green-500 rounded-full relative flex-shrink-0">
              <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-xs text-gray-500">Interval</p>
              {lastAt && <p className="text-xs text-gray-400">Last: {fmt(lastAt)}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIntervals(v => ({ ...v, [intervalKey]: Math.max(1, v[intervalKey] - 1) }))}
                className="w-8 h-8 rounded-xl bg-gray-100 text-gray-600 font-bold text-lg flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all"
              >
                −
              </button>
              <span className="text-sm font-semibold text-gray-800 w-16 text-center">
                {intervals[intervalKey]} days
              </span>
              <button
                onClick={() => setIntervals(v => ({ ...v, [intervalKey]: v[intervalKey] + 1 }))}
                className="w-8 h-8 rounded-xl bg-gray-100 text-gray-600 font-bold text-lg flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all"
              >
                +
              </button>
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={save}
        disabled={saving}
        className={`w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95 ${
          saved
            ? 'bg-green-100 text-green-700 border border-green-200'
            : 'bg-green-600 text-white hover:bg-green-700'
        } disabled:opacity-60`}
      >
        {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Changes'}
      </button>
    </div>
  )
}

// ── About Tab ─────────────────────────────────────────────────────────────────

function AboutTab({ plant }: { plant: Plant }) {
  const soilLabel = plant.soil_type
    ? SOIL_LABELS[plant.soil_type] ?? plant.mix_description ?? 'Custom'
    : null

  return (
    <div className="px-4 py-4 pb-28 max-w-lg mx-auto flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Plant Info</p>
          <Link href={`/plants/${plant.id}/edit`} className="text-xs text-green-600 font-medium">Edit →</Link>
        </div>
        <div className="divide-y divide-gray-50">
          <Row icon="🌿" label="Common name" value={plant.common_name} />
          {plant.scientific_name && <Row icon="" label="Scientific" value={plant.scientific_name} italic />}
          <Row icon={LOC_EMOJI[plant.location] ?? '📍'} label="Location" value={LOC_LABELS[plant.location] ?? plant.location} />
          <Row icon="🌍" label="Soil" value={soilLabel ?? 'Not set'} muted={!soilLabel} />
        </div>
      </div>

      {plant.notes && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</p>
          <p className="text-sm text-gray-700 leading-relaxed">{plant.notes}</p>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Care Tip</p>
        <TipsStream plantId={plant.id} />
      </div>

      <div className="flex gap-3">
        <Link
          href={`/plants/${plant.id}/chat`}
          className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white rounded-2xl px-4 py-3.5 font-semibold text-sm hover:bg-green-700 active:scale-95 transition-all"
        >
          💬 Ask Claude
        </Link>
        <Link
          href={`/plants/${plant.id}/edit`}
          className="flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-200 rounded-2xl px-4 py-3.5 font-semibold text-sm hover:bg-gray-50 active:scale-95 transition-all"
        >
          ✏️ Edit
        </Link>
      </div>
    </div>
  )
}

function Row({ icon, label, value, italic = false, muted = false }: {
  icon: string; label: string; value: string; italic?: boolean; muted?: boolean
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {icon && <span className="text-lg w-6 text-center flex-shrink-0">{icon}</span>}
      {!icon && <span className="w-6 flex-shrink-0" />}
      <span className="text-xs text-gray-400 w-20 flex-shrink-0">{label}</span>
      <span className={`text-sm flex-1 ${italic ? 'italic' : ''} ${muted ? 'text-gray-400' : 'text-gray-800 font-medium'}`}>
        {value}
      </span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PlantDetailView({
  plant,
  journal,
  primaryPhoto,
}: {
  plant: Plant
  journal: JournalEntry[]
  primaryPhoto: string | null
}) {
  const [tab, setTab] = useState<Tab>('timeline')

  const soilLabel = plant.soil_type
    ? SOIL_LABELS[plant.soil_type] ?? plant.mix_description ?? 'Custom'
    : null

  const TABS: { key: Tab; label: string }[] = [
    { key: 'timeline', label: 'Timeline' },
    { key: 'set-task', label: 'Set Task' },
    { key: 'about', label: 'About' },
  ]

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header card */}
      <div className="bg-white shadow-sm">
        {/* Back / Edit nav */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
          <Link href="/" className="text-green-600 font-medium text-sm flex items-center gap-1">
            ‹ Back
          </Link>
          <Link href={`/plants/${plant.id}/edit`} className="text-green-600 font-medium text-sm">
            Edit Plant
          </Link>
        </div>

        {/* Plant header */}
        <div className="flex gap-4 px-4 py-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-green-50 flex-shrink-0 shadow-sm">
            {primaryPhoto ? (
              <Image src={primaryPhoto} alt={plant.common_name} width={80} height={80} className="object-cover w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">🌿</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">{plant.common_name}</h1>
            {plant.scientific_name && (
              <p className="text-xs text-gray-400 italic mb-2">{plant.scientific_name}</p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-1">
              {soilLabel && (
                <span className="bg-green-50 border border-green-200 text-green-700 text-xs font-medium rounded-full px-2.5 py-0.5">
                  🌍 {soilLabel}
                </span>
              )}
              <span className="bg-green-50 border border-green-200 text-green-700 text-xs font-medium rounded-full px-2.5 py-0.5">
                {LOC_EMOJI[plant.location]} {LOC_LABELS[plant.location] ?? plant.location}
              </span>
            </div>
            {plant.notes && (
              <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">{plant.notes}</p>
            )}
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex border-t border-gray-100">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                tab === t.key ? 'text-green-700' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {t.label}
              {tab === t.key && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-green-600 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'timeline' && <TimelineTab journal={journal} plantId={plant.id} />}
      {tab === 'set-task' && <SetTaskTab plant={plant} />}
      {tab === 'about' && <AboutTab plant={plant} />}
    </main>
  )
}
