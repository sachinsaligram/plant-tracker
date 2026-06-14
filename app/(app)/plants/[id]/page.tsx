import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { TipsStream } from '@/components/tips-stream'
import { CareButtons } from '@/components/care-buttons'

type Params = { params: { id: string } }

function fmt(d: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC', ...opts,
  })
}

function fmtLong(d: string | null | undefined) {
  return fmt(d, { month: 'long', day: 'numeric', year: 'numeric' })
}

function relDay(d: string | null | undefined): string {
  if (!d) return '—'
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return `in ${diff}d`
}

function urgency(d: string | null | undefined): 'overdue' | 'soon' | 'ok' | 'none' {
  if (!d) return 'none'
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
  if (diff < 0) return 'overdue'
  if (diff <= 2) return 'soon'
  return 'ok'
}

const URGENCY_BG: Record<string, string> = {
  overdue: 'bg-red-500',
  soon: 'bg-amber-500',
  ok: 'bg-green-500',
  none: 'bg-gray-400',
}

const SOIL_LABELS: Record<string, string> = {
  'potting mix': '🪨 Potting Mix',
  'cactus mix': '🌵 Cactus Mix',
  'orchid mix': '🌸 Orchid Mix',
  'custom': '✨ Custom Mix',
}

const LOCATION_ICONS: Record<string, string> = {
  indoor: '🏠',
  outdoor: '🌳',
  balcony: '🌿',
  greenhouse: '🏡',
}

type JournalEntry = {
  event_type: string
  date: string
  notes: string | null
  photo_url: string | null
  product_name: string | null
}

function groupByMonth(entries: JournalEntry[]) {
  const groups: { label: string; entries: JournalEntry[] }[] = []
  for (const entry of entries) {
    const label = new Date(entry.date).toLocaleDateString('en-US', {
      month: 'long', year: 'numeric', timeZone: 'UTC',
    })
    const last = groups[groups.length - 1]
    if (last?.label === label) {
      last.entries.push(entry)
    } else {
      groups.push({ label, entries: [entry] })
    }
  }
  return groups
}

function entryIcon(type: string) {
  return type === 'water' ? '💧' : type === 'repot' ? '🪴' : type === 'fertilize' ? '🌱' : '📷'
}
function entryLabel(type: string) {
  return type === 'water' ? 'Watered' : type === 'repot' ? 'Repotted' : type === 'fertilize' ? 'Fed' : 'Photo'
}

export default async function PlantDetailPage({ params }: Params) {
  const session = await auth()
  if (!session) redirect('/login')

  const db = getDb()
  const [plantResult, journalResult, primaryPhotoResult] = await Promise.all([
    db.execute({
      sql: `SELECT p.*, s.type AS soil_type, s.mix_description
            FROM plants p
            LEFT JOIN soils s ON s.id = p.soil_id
            WHERE p.id = ? AND p.user_id = ?`,
      args: [params.id, session.user.id],
    }),
    db.execute({
      sql: `SELECT 'water' AS event_type, logged_at AS date, notes, NULL AS photo_url, NULL AS product_name
            FROM care_logs WHERE plant_id = ? AND type = 'water'
            UNION ALL
            SELECT 'repot', logged_at, notes, NULL, NULL
            FROM care_logs WHERE plant_id = ? AND type = 'repot'
            UNION ALL
            SELECT 'fertilize', fl.fed_at, fl.notes, NULL,
                   COALESCE(f.product_name, f.brand, NULL)
            FROM fertilizer_logs fl LEFT JOIN fertilizers f ON f.id = fl.fertilizer_id
            WHERE fl.plant_id = ?
            UNION ALL
            SELECT 'photo', taken_at, NULL, blob_url, NULL
            FROM plant_photos WHERE plant_id = ?
            ORDER BY date DESC
            LIMIT 60`,
      args: [params.id, params.id, params.id, params.id],
    }),
    db.execute({
      sql: 'SELECT blob_url FROM plant_photos WHERE plant_id = ? AND is_primary = 1 LIMIT 1',
      args: [params.id],
    }),
  ])

  const plant = plantResult.rows[0]
  if (!plant) redirect('/')

  const journalEntries = journalResult.rows as unknown as JournalEntry[]
  const journalGroups = groupByMonth(journalEntries)
  const primaryPhoto = primaryPhotoResult.rows[0]?.blob_url as string | undefined

  const waterU = urgency(plant.next_watering_at as string)
  const repotU = urgency(plant.next_repotting_at as string)
  const fertU = urgency(plant.next_fertilizing_at as string)

  const soilLabel = plant.soil_type
    ? SOIL_LABELS[plant.soil_type as string] ?? (plant.mix_description as string ?? '✨ Custom')
    : null

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="relative w-full h-64 bg-gradient-to-br from-green-600 to-green-800">
        {primaryPhoto && (
          <Image src={primaryPhoto} alt={plant.common_name as string} fill className="object-cover" />
        )}
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Nav */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4">
          <Link
            href="/"
            className="bg-black/30 backdrop-blur-sm text-white rounded-full px-3 py-1.5 text-sm font-medium"
          >
            ← Back
          </Link>
          <Link
            href={`/plants/${params.id}/edit`}
            className="bg-black/30 backdrop-blur-sm text-white rounded-full px-3 py-1.5 text-sm font-medium"
          >
            Edit ✏️
          </Link>
        </div>

        {/* Plant name overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <h1 className="text-2xl font-bold text-white leading-tight">{plant.common_name as string}</h1>
          {plant.scientific_name && (
            <p className="text-white/70 italic text-sm mt-0.5">{plant.scientific_name as string}</p>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 pb-28 flex flex-col gap-5">

        {/* Care status row */}
        <div className="grid grid-cols-3 gap-2 -mt-1">
          {[
            { emoji: '💧', label: 'Water', next: plant.next_watering_at as string, u: waterU },
            { emoji: '🪴', label: 'Repot', next: plant.next_repotting_at as string, u: repotU },
            { emoji: '🌱', label: 'Feed', next: plant.next_fertilizing_at as string, u: fertU },
          ].map(({ emoji, label, next, u }) => (
            <div key={label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className={`w-2 h-2 rounded-full ${URGENCY_BG[u]}`} />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
              </div>
              <p className="text-sm font-bold text-gray-900">{relDay(next)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{fmt(next)}</p>
            </div>
          ))}
        </div>

        {/* Log care */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Log Care</h2>
          <CareButtons plantId={params.id} />
        </div>

        {/* Plant profile */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Plant Profile</h2>
            <Link href={`/plants/${params.id}/edit`} className="text-xs text-green-600 font-medium">Edit →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            <ProfileRow icon={LOCATION_ICONS[plant.location as string] ?? '📍'} label="Location"
              value={(plant.location as string).charAt(0).toUpperCase() + (plant.location as string).slice(1)} />
            <ProfileRow icon="🌍" label="Soil" value={soilLabel ?? 'Not set'} muted={!soilLabel} />
            <ProfileRow icon="💧" label="Water every" value={`${plant.watering_interval_days} days`} />
            <ProfileRow icon="🪴" label="Repot every" value={`${plant.repotting_interval_days} days`} />
            <ProfileRow icon="🌱" label="Feed every" value={`${plant.fertilizing_interval_days} days`} />
            {plant.notes && (
              <div className="px-4 py-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700 leading-relaxed">{plant.notes as string}</p>
              </div>
            )}
          </div>
        </div>

        {/* Care tip */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Care Tip</h2>
          <TipsStream plantId={params.id} />
        </div>

        {/* Journal */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Journal</h2>
            <span className="text-xs text-gray-400">{journalEntries.length} entries</span>
          </div>

          {journalEntries.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-8 text-center">
              <p className="text-3xl mb-2">📖</p>
              <p className="text-sm text-gray-500">No entries yet. Log care to start your journal.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {journalGroups.map(group => (
                <div key={group.label}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                    {group.label}
                  </p>
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    {group.entries.map((entry, i) => (
                      <div
                        key={i}
                        className={`flex gap-3 px-4 py-3 ${i < group.entries.length - 1 ? 'border-b border-gray-50' : ''}`}
                      >
                        {/* Icon column */}
                        <div className="flex flex-col items-center pt-0.5">
                          <span className="text-xl">{entryIcon(entry.event_type)}</span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-semibold text-gray-800">
                              {entryLabel(entry.event_type)}
                              {entry.product_name && (
                                <span className="font-normal text-gray-500"> · {entry.product_name}</span>
                              )}
                            </span>
                            <span className="text-xs text-gray-400 flex-shrink-0">{fmt(entry.date)}</span>
                          </div>
                          {entry.notes && (
                            <p className="text-sm text-gray-500 mt-0.5 leading-snug">"{entry.notes}"</p>
                          )}
                          {entry.photo_url && (
                            <div className="mt-2 w-24 h-24 rounded-xl overflow-hidden bg-gray-100">
                              <Image
                                src={entry.photo_url}
                                alt="Plant photo"
                                width={96}
                                height={96}
                                className="object-cover w-full h-full"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ask Claude CTA */}
        <Link
          href={`/plants/${params.id}/chat`}
          className="flex items-center justify-between bg-green-600 text-white rounded-2xl px-5 py-4 hover:bg-green-700 active:scale-95 transition-all"
        >
          <div>
            <p className="font-semibold">Ask Claude</p>
            <p className="text-green-200 text-xs mt-0.5">Get personalized care advice</p>
          </div>
          <span className="text-2xl">💬</span>
        </Link>
      </div>
    </main>
  )
}

function ProfileRow({
  icon, label, value, muted = false,
}: {
  icon: string; label: string; value: string; muted?: boolean
}) {
  return (
    <div className="flex items-center px-4 py-3 gap-3">
      <span className="text-lg w-7 text-center flex-shrink-0">{icon}</span>
      <span className="text-xs text-gray-500 w-20 flex-shrink-0">{label}</span>
      <span className={`text-sm font-medium flex-1 ${muted ? 'text-gray-400 italic' : 'text-gray-800'}`}>{value}</span>
    </div>
  )
}
