'use client'
import { useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export type PlantFeed = {
  id: string
  common_name: string
  scientific_name: string | null
  location: string
  primary_photo: string | null
  next_watering_at: string | null
  next_repotting_at: string | null
  next_fertilizing_at: string | null
  last_watered_at: string | null
  last_repotted_at: string | null
  last_fertilized_at: string | null
}

const CARE_EMOJI: Record<string, string> = { water: '💧', repot: '🪴', fertilize: '🌱' }
const CARE_LABEL: Record<string, string> = { water: 'Needs Water', repot: 'Needs Repotting', fertilize: 'Needs Feeding' }
const CARE_ACTION: Record<string, string> = { water: 'Water', repot: 'Repot', fertilize: 'Feed' }
const CARE_COLOR: Record<string, string> = {
  water: 'bg-blue-500 hover:bg-blue-600',
  repot: 'bg-amber-500 hover:bg-amber-600',
  fertilize: 'bg-green-600 hover:bg-green-700',
}
const LOC_LABEL: Record<string, string> = {
  indoor: 'Indoor', outdoor: 'Outdoor', balcony: 'Balcony', greenhouse: 'Greenhouse',
}

function daysAgo(d: string): number {
  return Math.round((Date.now() - new Date(d).getTime()) / 86_400_000)
}
function relPast(d: string): string {
  const diff = daysAgo(d)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff} days ago`
}

function nextCareItem(p: PlantFeed): { days: number; type: string } | null {
  const items: { date: string; type: string }[] = []
  if (p.next_watering_at) items.push({ date: p.next_watering_at, type: 'water' })
  if (p.next_repotting_at) items.push({ date: p.next_repotting_at, type: 'repot' })
  if (p.next_fertilizing_at) items.push({ date: p.next_fertilizing_at, type: 'fertilize' })
  if (!items.length) return null
  items.sort((a, b) => a.date.localeCompare(b.date))
  const diff = Math.ceil((new Date(items[0].date).getTime() - Date.now()) / 86_400_000)
  return { days: diff, type: items[0].type }
}

function nextCareLabel(next: { days: number; type: string }): string {
  const label = CARE_LABEL[next.type]
  if (next.days < 0) return `${Math.abs(next.days)}d overdue · ${label}`
  if (next.days === 0) return `Today · ${label}`
  if (next.days === 1) return `Tomorrow · ${label}`
  return `In ${next.days} days · ${label}`
}

function lastCareLabel(p: PlantFeed): string | null {
  const events: { date: string; label: string }[] = []
  if (p.last_watered_at) events.push({ date: p.last_watered_at, label: 'Watered' })
  if (p.last_repotted_at) events.push({ date: p.last_repotted_at, label: 'Repotted' })
  if (p.last_fertilized_at) events.push({ date: p.last_fertilized_at, label: 'Fed' })
  if (!events.length) return null
  events.sort((a, b) => b.date.localeCompare(a.date))
  return `${relPast(events[0].date)} · ${events[0].label}`
}

// Reminders: group plants by due date for each care type
type ReminderItem = { plant: PlantFeed; types: string[]; dateKey: string }
type ReminderGroup = { label: string; dateKey: string; items: ReminderItem[] }

function buildReminders(plants: PlantFeed[]): ReminderGroup[] {
  const map = new Map<string, ReminderGroup>()
  for (const p of plants) {
    const byDate = new Map<string, string[]>()
    const careItems: { date: string; type: string }[] = []
    if (p.next_watering_at) careItems.push({ date: p.next_watering_at, type: 'water' })
    if (p.next_repotting_at) careItems.push({ date: p.next_repotting_at, type: 'repot' })
    if (p.next_fertilizing_at) careItems.push({ date: p.next_fertilizing_at, type: 'fertilize' })
    for (const c of careItems) {
      const key = c.date.slice(0, 10)
      if (!byDate.has(key)) byDate.set(key, [])
      byDate.get(key)!.push(c.type)
    }
    for (const dk of Array.from(byDate.keys())) {
      const types = byDate.get(dk)!
      if (!map.has(dk)) {
        const diff = Math.ceil((new Date(dk).getTime() - Date.now()) / 86_400_000)
        const dayLabel = diff < 0 ? 'Overdue' : diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `In ${diff} days`
        const dateLabel = new Date(dk).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
        map.set(dk, { label: `${dayLabel}, ${dateLabel}`, dateKey: dk, items: [] })
      }
      map.get(dk)!.items.push({ plant: p, types, dateKey: dk })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey))
}

function PlantCard({ plant, onLogged }: { plant: PlantFeed; onLogged: () => void }) {
  const router = useRouter()
  const [logging, setLogging] = useState<string | null>(null)
  const next = nextCareItem(plant)
  const last = lastCareLabel(plant)
  const isUrgent = next && next.days <= 0
  const isSoon = next && next.days > 0 && next.days <= 2

  async function logCare(type: string, e: React.MouseEvent) {
    e.preventDefault()
    setLogging(type)
    await fetch('/api/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant_id: plant.id, type }),
    })
    setLogging(null)
    router.refresh()
    onLogged()
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      <Link href={`/plants/${plant.id}`} className="flex gap-3 p-3">
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-green-50 flex-shrink-0">
          {plant.primary_photo ? (
            <Image src={plant.primary_photo} alt={plant.common_name} width={64} height={64} className="object-cover w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">🌿</div>
          )}
        </div>
        <div className="flex-1 min-w-0 py-0.5">
          <p className="font-semibold text-gray-900 text-sm">{plant.common_name}</p>
          {last && (
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              <span>📅</span> {last}
            </p>
          )}
          {next && (
            <p className={`text-xs mt-0.5 flex items-center gap-1 ${
              isUrgent ? 'text-red-500' : isSoon ? 'text-amber-500' : 'text-gray-400'
            }`}>
              <span>🔔</span> {nextCareLabel(next)}
            </p>
          )}
        </div>
      </Link>
      <div className="flex items-center gap-2 px-3 pb-3">
        <Link
          href={`/plants/${plant.id}`}
          className="flex-1 text-center py-1.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          More
        </Link>
        {next && (
          <button
            onClick={(e) => logCare(next.type, e)}
            disabled={!!logging}
            className={`flex-1 py-1.5 rounded-xl text-white text-xs font-semibold ${CARE_COLOR[next.type]} disabled:opacity-60 active:scale-95 transition-all`}
          >
            {logging ? '…' : `${CARE_EMOJI[next.type]} ${CARE_ACTION[next.type]}`}
          </button>
        )}
      </div>
    </div>
  )
}

function ReminderCard({ group, onDone }: { group: ReminderGroup; onDone: () => void }) {
  const router = useRouter()
  const [logging, setLogging] = useState<string | null>(null)

  async function finish(plantId: string, type: string) {
    const key = `${plantId}-${type}`
    setLogging(key)
    await fetch('/api/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant_id: plantId, type }),
    })
    setLogging(null)
    router.refresh()
    onDone()
  }

  const isOverdue = group.dateKey < new Date().toISOString().slice(0, 10)
  const isToday = group.dateKey === new Date().toISOString().slice(0, 10)

  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wider mb-2 px-1 ${
        isOverdue ? 'text-red-500' : isToday ? 'text-green-600' : 'text-gray-400'
      }`}>
        {group.label}
      </p>
      <div className="flex flex-col gap-2">
        {group.items.map(({ plant, types }) => (
          <div key={plant.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-3 pt-3 pb-2">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-green-50 flex-shrink-0">
                {plant.primary_photo ? (
                  <Image src={plant.primary_photo} alt={plant.common_name} width={40} height={40} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-base">🌿</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{plant.common_name}</p>
                <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{LOC_LABEL[plant.location] ?? plant.location}</span>
              </div>
            </div>
            <div className="border-t border-gray-50">
              {types.map(type => (
                <div key={type} className="flex items-center justify-between px-3 py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-700">{CARE_EMOJI[type]} {CARE_ACTION[type]}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300 text-sm">🔔</span>
                    <button
                      onClick={() => finish(plant.id, type)}
                      disabled={!!logging}
                      className="bg-green-500 text-white text-xs font-semibold rounded-lg px-3 py-1.5 hover:bg-green-600 disabled:opacity-50 active:scale-95 transition-all"
                    >
                      {logging === `${plant.id}-${type}` ? '…' : 'Finish'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FeedView({ plants }: { plants: PlantFeed[] }) {
  const [tab, setTab] = useState<'plants' | 'reminders'>('plants')
  const [search, setSearch] = useState('')
  const [location, setLocation] = useState('all')
  const [refreshKey, setRefreshKey] = useState(0)

  const locations = useMemo(() => {
    const seen: string[] = []
    for (const p of plants) {
      if (!seen.includes(p.location)) seen.push(p.location)
    }
    return seen
  }, [plants])

  const filtered = useMemo(() => {
    return plants.filter(p => {
      const matchLoc = location === 'all' || p.location === location
      const matchSearch = !search || p.common_name.toLowerCase().includes(search.toLowerCase())
      return matchLoc && matchSearch
    })
  }, [plants, location, search])

  const reminders = useMemo(() => buildReminders(plants), [plants])
  const pendingCount = reminders.filter(g =>
    g.dateKey <= new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  ).reduce((n, g) => n + g.items.reduce((m, i) => m + i.types.length, 0), 0)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">🌿</span>
            <div className="flex gap-1">
              <button
                onClick={() => setTab('plants')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                  tab === 'plants' ? 'text-green-700 bg-green-50' : 'text-gray-400'
                }`}
              >
                My Plants
              </button>
              <button
                onClick={() => setTab('reminders')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors relative ${
                  tab === 'reminders' ? 'text-green-700 bg-green-50' : 'text-gray-400'
                }`}
              >
                Reminders
                {pendingCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </button>
            </div>
            <Link
              href="/settings"
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
            >
              ⚙️
            </Link>
          </div>

          {tab === 'plants' && (
            <>
              <div className="relative mb-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                <input
                  type="search"
                  placeholder="Search plants…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-gray-100 rounded-xl pl-8 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition-colors"
                />
              </div>
              {locations.length > 1 && (
                <div className="flex gap-2 pb-3 overflow-x-auto scrollbar-hide">
                  {['all', ...locations].map(loc => (
                    <button
                      key={loc}
                      onClick={() => setLocation(loc)}
                      className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        location === loc
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
                      }`}
                    >
                      {loc === 'all' ? 'All' : LOC_LABEL[loc] ?? loc}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto w-full px-4 py-4 pb-28 flex flex-col gap-3 flex-1">
        {tab === 'plants' ? (
          filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center pt-20 gap-5">
              {plants.length === 0 ? (
                <>
                  <div className="text-8xl">🪴</div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">No plants yet</h2>
                    <p className="text-gray-500 text-sm">Photograph a plant and Claude will identify it and set up a care schedule.</p>
                  </div>
                  <Link href="/plants/new" className="bg-green-600 text-white px-6 py-3 rounded-full font-medium text-sm">
                    + Add your first plant
                  </Link>
                </>
              ) : (
                <>
                  <div className="text-5xl">🔍</div>
                  <p className="text-gray-500 text-sm">No plants match your search.</p>
                </>
              )}
            </div>
          ) : (
            filtered.map(p => (
              <PlantCard key={`${p.id}-${refreshKey}`} plant={p} onLogged={() => setRefreshKey(k => k + 1)} />
            ))
          )
        ) : (
          reminders.length === 0 ? (
            <div className="flex flex-col items-center text-center pt-20 gap-4">
              <div className="text-5xl">🎉</div>
              <p className="text-gray-500 text-sm">No upcoming reminders.</p>
            </div>
          ) : (
            reminders.map(g => (
              <ReminderCard key={g.dateKey} group={g} onDone={() => setRefreshKey(k => k + 1)} />
            ))
          )
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-6 right-4 z-20">
        <Link
          href="/plants/new"
          className="w-14 h-14 bg-green-600 text-white rounded-full flex items-center justify-center text-2xl shadow-lg hover:bg-green-700 active:scale-95 transition-all"
        >
          +
        </Link>
      </div>
    </div>
  )
}
