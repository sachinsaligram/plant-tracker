'use client'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  id: string
  event_type: string
  date: string
  notes: string | null
  photo_url: string | null
  product_name: string | null
  dosage: number | null
  dosage_unit: string | null
}

type Tab = 'timeline' | 'set-task' | 'about'
type Filter = 'all' | 'water' | 'fertilize' | 'photo' | 'repot'

const SOIL_LABELS: Record<string, string> = {
  'potting mix': 'Potting Mix', 'cactus mix': 'Cactus Mix',
  'orchid mix': 'Orchid Mix', 'custom': 'Custom Mix',
}
const LOC_LABELS: Record<string, string> = {
  indoor: 'Indoor', outdoor: 'Outdoor', balcony: 'Balcony', greenhouse: 'Greenhouse',
}
const LOC_EMOJI: Record<string, string> = {
  indoor: '🏠', outdoor: '🌳', balcony: '🌿', greenhouse: '🏡',
}

// Per-type color schemes
const TYPE_COLORS: Record<string, { dot: string; bg: string; text: string; border: string; btn: string }> = {
  water:     { dot: 'border-blue-400 bg-blue-100',    bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200',   btn: 'bg-blue-500 hover:bg-blue-600' },
  repot:     { dot: 'border-amber-400 bg-amber-100',  bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200',  btn: 'bg-amber-500 hover:bg-amber-600' },
  fertilize: { dot: 'border-emerald-400 bg-emerald-100', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', btn: 'bg-emerald-500 hover:bg-emerald-600' },
  photo:     { dot: 'border-violet-400 bg-violet-100', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200',  btn: 'bg-violet-500 hover:bg-violet-600' },
}

function fmt(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}
function relDay(d: string | null | undefined) {
  if (!d) return '—'
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return `in ${diff}d`
}
function entryDay(date: string) {
  const diff = Math.round((Date.now() - new Date(date).getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
function entryYear(date: string) {
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
const SOIL_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'potting mix', label: '🪨 Potting Mix' },
  { value: 'cactus mix', label: '🌵 Cactus Mix' },
  { value: 'orchid mix', label: '🌸 Orchid Mix' },
  { value: 'custom', label: '✨ Custom Mix' },
]
const DOSAGE_UNITS = ['ml', 'g', 'tsp', 'tbsp']

// ── Timeline Tab ──────────────────────────────────────────────────────────────

function TimelineTab({ journal, plantId }: { journal: JournalEntry[]; plantId: string }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [fertForm, setFertForm] = useState({ product: '', dosage: '', unit: 'ml', note: '' })
  const [repotForm, setRepotForm] = useState({ soil: '', note: '' })
  const [logging, setLogging] = useState<string | null>(null)
  const [doneType, setDoneType] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const router = useRouter()

  const filtered = filter === 'all' ? journal : journal.filter(e => e.event_type === filter)

  async function logCare(type: string) {
    setLogging(type)
    const body: Record<string, unknown> = { plant_id: plantId, type }
    if (type === 'fertilize') {
      if (fertForm.product) body.product_name = fertForm.product
      if (fertForm.dosage) { body.dosage = parseFloat(fertForm.dosage); body.dosage_unit = fertForm.unit }
      if (fertForm.note) body.notes = fertForm.note
    } else if (type === 'repot') {
      if (repotForm.soil) body.soil_type = repotForm.soil
      if (repotForm.note) body.notes = repotForm.note
    } else {
      if (noteText) body.notes = noteText
    }
    await fetch('/api/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setLogging(null)
    setDoneType(type)
    setExpanded(null)
    setNoteText('')
    setFertForm({ product: '', dosage: '', unit: 'ml', note: '' })
    setRepotForm({ soil: '', note: '' })
    setTimeout(() => setDoneType(null), 3000)
    router.refresh()
  }

  async function deleteEntry(entry: JournalEntry) {
    setDeletingId(entry.id)
    await fetch('/api/care-logs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: entry.id, entry_type: entry.event_type }),
    })
    setDeletingId(null)
    setConfirmDeleteId(null)
    router.refresh()
  }

  const CARE_TYPES = [
    { type: 'water', emoji: '💧', label: 'Water' },
    { type: 'fertilize', emoji: '🌱', label: 'Feed' },
    { type: 'repot', emoji: '🪴', label: 'Repot' },
  ]

  return (
    <div className="flex flex-col">
      {/* Filter chips */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-white border-b border-gray-100">
        {FILTER_LABELS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filter === f.key
                ? 'bg-green-600 text-white border-green-600 shadow-sm'
                : 'bg-white text-gray-500 border-gray-200 hover:border-green-300 hover:text-green-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Timeline entries */}
      <div className="px-4 py-4 pb-40">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-3">📖</p>
            <p className="text-gray-400 text-sm">No entries yet.</p>
            <p className="text-gray-400 text-xs mt-1">Log care below to start your journal.</p>
          </div>
        ) : (
          <div>
            {filtered.map((entry, i) => {
              const c = TYPE_COLORS[entry.event_type] ?? TYPE_COLORS.water
              const isConfirming = confirmDeleteId === entry.id
              const isDeleting = deletingId === entry.id
              return (
                <div key={entry.id} className="flex gap-3">
                  {/* Date column */}
                  <div className="w-14 flex-shrink-0 text-right pt-0.5">
                    <p className="text-xs font-semibold text-gray-700 leading-tight">{entryDay(entry.date)}</p>
                    <p className="text-xs text-gray-400">{entryYear(entry.date)}</p>
                  </div>

                  {/* Timeline connector */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-3 h-3 rounded-full border-2 ${c.dot} flex-shrink-0 mt-0.5 z-10`} />
                    {i < filtered.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                  </div>

                  {/* Content */}
                  <div className={`flex-1 min-w-0 rounded-2xl border mb-3 ${isConfirming ? 'bg-red-50 border-red-200' : `${c.bg} ${c.border}`}`}>
                    <div className="px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${c.text}`}>
                            {EVENT_ICON[entry.event_type]} {EVENT_LABEL[entry.event_type]}
                            {entry.product_name && (
                              <span className="font-normal text-gray-600"> · {entry.product_name}</span>
                            )}
                          </p>
                          {(entry.dosage || entry.dosage_unit) && entry.dosage && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {entry.dosage} {entry.dosage_unit ?? ''}
                            </p>
                          )}
                          {entry.notes && (
                            <p className="text-xs text-gray-500 mt-0.5 italic">"{entry.notes}"</p>
                          )}
                          {entry.photo_url && (
                            <div className="mt-2 w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                              <Image src={entry.photo_url} alt="" width={80} height={80} className="object-cover w-full h-full" />
                            </div>
                          )}
                        </div>

                        {/* Delete button */}
                        {entry.event_type !== 'photo' && (
                          <div className="flex-shrink-0">
                            {isConfirming ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-2 py-1"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => deleteEntry(entry)}
                                  disabled={isDeleting}
                                  className="text-xs text-white bg-red-500 rounded-lg px-2 py-1 font-medium disabled:opacity-60"
                                >
                                  {isDeleting ? '…' : 'Delete'}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(entry.id)}
                                className="text-gray-300 hover:text-red-400 transition-colors p-1"
                                aria-label="Delete entry"
                              >
                                🗑
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Floating log care bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-100 px-4 py-3 z-20">
        <div className="max-w-lg mx-auto">
          {expanded ? (
            <div className="flex flex-col gap-2">
              {expanded === 'fertilize' ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Fertilizer name (e.g. Miracle-Gro)"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={fertForm.product}
                    onChange={e => setFertForm(f => ({ ...f, product: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Amount"
                      min="0"
                      step="0.5"
                      className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      value={fertForm.dosage}
                      onChange={e => setFertForm(f => ({ ...f, dosage: e.target.value }))}
                    />
                    <select
                      className="w-20 rounded-xl border border-gray-200 bg-gray-50 px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      value={fertForm.unit}
                      onChange={e => setFertForm(f => ({ ...f, unit: e.target.value }))}
                    >
                      {DOSAGE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="Note (optional)"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={fertForm.note}
                    onChange={e => setFertForm(f => ({ ...f, note: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && logCare('fertilize')}
                  />
                </>
              ) : expanded === 'repot' ? (
                <>
                  <select
                    autoFocus
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={repotForm.soil}
                    onChange={e => setRepotForm(f => ({ ...f, soil: e.target.value }))}
                  >
                    {SOIL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input
                    type="text"
                    placeholder="Note (e.g. moved to larger pot)"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={repotForm.note}
                    onChange={e => setRepotForm(f => ({ ...f, note: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && logCare('repot')}
                  />
                </>
              ) : (
                <input
                  autoFocus
                  type="text"
                  placeholder="Add a note (optional)"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && logCare(expanded)}
                />
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setExpanded(null); setNoteText('') }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium bg-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => logCare(expanded)}
                  disabled={!!logging}
                  className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 ${
                    TYPE_COLORS[expanded]?.btn ?? 'bg-green-600'
                  }`}
                >
                  {logging ? '…' : `Log ${CARE_TYPES.find(c => c.type === expanded)?.label ?? expanded}`}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {CARE_TYPES.map(({ type, emoji, label }) => {
                const c = TYPE_COLORS[type]
                return (
                  <button
                    key={type}
                    onClick={() => setExpanded(type)}
                    disabled={!!logging}
                    className={`flex-1 py-2.5 rounded-2xl text-sm font-semibold border active:scale-95 transition-all disabled:opacity-60 ${
                      doneType === type
                        ? 'bg-gray-100 text-gray-400 border-gray-200'
                        : `${c.bg} ${c.text} ${c.border} hover:shadow-sm`
                    }`}
                  >
                    {doneType === type ? '✓' : `${emoji} ${label}`}
                  </button>
                )
              })}
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
    setTimeout(() => setSaved(false), 2500)
    router.refresh()
  }

  const tasks = [
    { emoji: '💧', label: 'Water', key: 'watering_interval_days' as const, lastAt: plant.last_watered_at, nextAt: plant.next_watering_at, type: 'water' },
    { emoji: '🌱', label: 'Fertilize', key: 'fertilizing_interval_days' as const, lastAt: plant.last_fertilized_at, nextAt: plant.next_fertilizing_at, type: 'fertilize' },
    { emoji: '🪴', label: 'Repot', key: 'repotting_interval_days' as const, lastAt: plant.last_repotted_at, nextAt: plant.next_repotting_at, type: 'repot' },
  ]

  return (
    <div className="px-4 py-4 pb-24 max-w-lg mx-auto flex flex-col gap-3">
      {tasks.map(({ emoji, label, key, lastAt, nextAt, type }) => {
        const c = TYPE_COLORS[type]
        return (
          <div key={key} className={`rounded-2xl border ${c.border} ${c.bg} overflow-hidden`}>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="text-2xl">{emoji}</span>
              <div className="flex-1">
                <p className={`font-bold text-sm ${c.text}`}>{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {nextAt ? `Next ${relDay(nextAt)} · ${fmt(nextAt)}` : 'Not scheduled'}
                </p>
              </div>
              <div className="w-10 h-6 bg-green-500 rounded-full relative flex-shrink-0 shadow-sm">
                <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
              </div>
            </div>
            <div className={`flex items-center justify-between px-4 py-3 border-t ${c.border} bg-white/60`}>
              <div>
                <p className="text-xs font-medium text-gray-500">Repeat every</p>
                {lastAt && <p className="text-xs text-gray-400 mt-0.5">Last: {fmt(lastAt)}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIntervals(v => ({ ...v, [key]: Math.max(1, v[key] - 1) }))}
                  className="w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-600 font-bold text-xl flex items-center justify-center shadow-sm active:scale-95 transition-all"
                >−</button>
                <span className="text-sm font-bold text-gray-800 w-16 text-center">{intervals[key]}d</span>
                <button
                  onClick={() => setIntervals(v => ({ ...v, [key]: v[key] + 1 }))}
                  className="w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-600 font-bold text-xl flex items-center justify-center shadow-sm active:scale-95 transition-all"
                >+</button>
              </div>
            </div>
          </div>
        )
      })}
      <button
        onClick={save}
        disabled={saving}
        className={`w-full py-4 rounded-2xl font-bold text-sm transition-all active:scale-95 shadow-sm ${
          saved ? 'bg-green-100 text-green-700 border border-green-300'
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
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const soilLabel = plant.soil_type
    ? SOIL_LABELS[plant.soil_type] ?? plant.mix_description ?? 'Custom'
    : null

  async function deletePlant() {
    setDeleting(true)
    await fetch(`/api/plants/${plant.id}`, { method: 'DELETE' })
    router.push('/')
  }

  return (
    <div className="px-4 py-4 pb-24 max-w-lg mx-auto flex flex-col gap-4">
      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 bg-gray-50/50">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Plant Profile</p>
          <Link href={`/plants/${plant.id}/edit`} className="text-xs text-green-600 font-semibold">Edit →</Link>
        </div>
        <div className="divide-y divide-gray-50">
          <AboutRow emoji="🌿" label="Name" value={plant.common_name} />
          {plant.scientific_name && <AboutRow emoji="" label="Scientific" value={plant.scientific_name} italic />}
          <AboutRow emoji={LOC_EMOJI[plant.location] ?? '📍'} label="Location" value={LOC_LABELS[plant.location] ?? plant.location} />
          <AboutRow emoji="🌍" label="Soil" value={soilLabel ?? 'Not set'} muted={!soilLabel} />
          <AboutRow emoji="💧" label="Water every" value={`${plant.watering_interval_days} days`} />
          <AboutRow emoji="🌱" label="Feed every" value={`${plant.fertilizing_interval_days} days`} />
          <AboutRow emoji="🪴" label="Repot every" value={`${plant.repotting_interval_days} days`} />
        </div>
      </div>

      {/* Notes */}
      {plant.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1.5">📝 Notes</p>
          <p className="text-sm text-amber-900 leading-relaxed">{plant.notes}</p>
        </div>
      )}

      {/* Care tip */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Claude's Tip</p>
        <TipsStream plantId={plant.id} />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Link
          href={`/plants/${plant.id}/chat`}
          className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white rounded-2xl px-4 py-3.5 font-bold text-sm hover:bg-green-700 active:scale-95 transition-all shadow-sm"
        >
          💬 Ask Claude
        </Link>
        <Link
          href={`/plants/${plant.id}/edit`}
          className="flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-200 rounded-2xl px-4 py-3.5 font-bold text-sm hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
        >
          ✏️ Edit
        </Link>
      </div>

      {/* Danger zone */}
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
        <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">Danger Zone</p>
        {confirmDelete ? (
          <div>
            <p className="text-sm text-red-700 mb-3">This will permanently delete the plant and all its care history and photos.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={deletePlant}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold disabled:opacity-60 hover:bg-red-600 active:scale-95 transition-all"
              >
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-red-600 font-semibold hover:text-red-700"
          >
            🗑 Delete this plant
          </button>
        )}
      </div>
    </div>
  )
}

function AboutRow({ emoji, label, value, italic = false, muted = false }: {
  emoji: string; label: string; value: string; italic?: boolean; muted?: boolean
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-lg w-6 text-center flex-shrink-0">{emoji}</span>
      <span className="text-xs text-gray-400 w-20 flex-shrink-0">{label}</span>
      <span className={`text-sm flex-1 ${italic ? 'italic' : 'font-medium'} ${muted ? 'text-gray-400 italic' : 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PlantDetailView({
  plant, journal, primaryPhoto,
}: {
  plant: Plant
  journal: JournalEntry[]
  primaryPhoto: string | null
}) {
  const [tab, setTab] = useState<Tab>('timeline')
  const soilLabel = plant.soil_type ? SOIL_LABELS[plant.soil_type] ?? plant.mix_description ?? 'Custom' : null

  const urgencyColors = () => {
    const diffs = [plant.next_watering_at, plant.next_repotting_at, plant.next_fertilizing_at]
      .filter(Boolean)
      .map(d => Math.ceil((new Date(d!).getTime() - Date.now()) / 86_400_000))
    const min = Math.min(...diffs)
    if (min < 0) return 'from-red-500 to-red-600'
    if (min <= 2) return 'from-amber-500 to-amber-600'
    return 'from-green-600 to-emerald-600'
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'timeline', label: 'Timeline' },
    { key: 'set-task', label: 'Set Task' },
    { key: 'about', label: 'About' },
  ]

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Sticky header card */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        {/* Nav row */}
        <div className={`bg-gradient-to-r ${urgencyColors()} px-4 pt-4 pb-3`}>
          <div className="flex items-center justify-between mb-3">
            <Link href="/" className="text-white/90 font-semibold text-sm bg-white/20 rounded-full px-3 py-1 backdrop-blur-sm">
              ‹ Back
            </Link>
            <Link href={`/plants/${plant.id}/edit`} className="text-white/90 font-semibold text-sm bg-white/20 rounded-full px-3 py-1 backdrop-blur-sm">
              Edit Plant
            </Link>
          </div>

          {/* Plant header */}
          <div className="flex gap-3 items-start">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/20 flex-shrink-0 shadow-md border-2 border-white/30">
              {primaryPhoto ? (
                <Image src={primaryPhoto} alt={plant.common_name} width={64} height={64} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">🌿</div>
              )}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h1 className="text-lg font-bold text-white leading-tight">{plant.common_name}</h1>
              {plant.scientific_name && (
                <p className="text-white/70 italic text-xs mt-0.5">{plant.scientific_name}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {soilLabel && (
                  <span className="bg-white/20 text-white text-xs font-medium rounded-full px-2.5 py-0.5 backdrop-blur-sm">
                    🌍 {soilLabel}
                  </span>
                )}
                <span className="bg-white/20 text-white text-xs font-medium rounded-full px-2.5 py-0.5 backdrop-blur-sm">
                  {LOC_EMOJI[plant.location]} {LOC_LABELS[plant.location] ?? plant.location}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex border-b border-gray-100">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
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

      {tab === 'timeline' && <TimelineTab journal={journal} plantId={plant.id} />}
      {tab === 'set-task' && <SetTaskTab plant={plant} />}
      {tab === 'about' && <AboutTab plant={plant} />}
    </main>
  )
}
