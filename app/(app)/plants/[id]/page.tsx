import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TipsStream } from '@/components/tips-stream'
import { PhotoTimeline } from '@/components/photo-timeline'
import { CareButtons } from '@/components/care-buttons'

type Params = { params: { id: string } }

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function relativeDay(d: string | null): string {
  if (!d) return ''
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return `in ${diff}d`
}

function urgency(d: string | null): 'overdue' | 'soon' | 'ok' {
  if (!d) return 'ok'
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
  if (diff < 0) return 'overdue'
  if (diff <= 2) return 'soon'
  return 'ok'
}

const URGENCY_CLASSES = {
  overdue: 'bg-red-50 border-red-200',
  soon: 'bg-amber-50 border-amber-200',
  ok: 'bg-white border-gray-100',
}

const URGENCY_LABEL_CLASSES = {
  overdue: 'text-red-600',
  soon: 'text-amber-600',
  ok: 'text-gray-500',
}

const SOIL_LABELS: Record<string, string> = {
  'potting mix': '🪨 Potting Mix',
  'cactus mix': '🌵 Cactus Mix',
  'orchid mix': '🌸 Orchid Mix',
  'custom': '✨ Custom Mix',
}

const CARE_LOG_LABELS: Record<string, string> = {
  water: '💧 Watered',
  repot: '🪴 Repotted',
  fertilize: '🌱 Fed',
}

export default async function PlantDetailPage({ params }: Params) {
  const session = await auth()
  if (!session) redirect('/login')

  const db = getDb()
  const [plantResult, photosResult, careLogsResult, fertLogsResult] = await Promise.all([
    db.execute({
      sql: `SELECT p.*, s.type AS soil_type, s.mix_description
            FROM plants p
            LEFT JOIN soils s ON s.id = p.soil_id
            WHERE p.id = ? AND p.user_id = ?`,
      args: [params.id, session.user.id],
    }),
    db.execute({
      sql: 'SELECT * FROM plant_photos WHERE plant_id = ? ORDER BY taken_at ASC',
      args: [params.id],
    }),
    db.execute({
      sql: 'SELECT * FROM care_logs WHERE plant_id = ? ORDER BY logged_at DESC LIMIT 10',
      args: [params.id],
    }),
    db.execute({
      sql: `SELECT fl.fed_at, f.product_name, f.brand
            FROM fertilizer_logs fl
            LEFT JOIN fertilizers f ON f.id = fl.fertilizer_id
            WHERE fl.plant_id = ?
            ORDER BY fl.fed_at DESC LIMIT 5`,
      args: [params.id],
    }),
  ])

  const plant = plantResult.rows[0]
  if (!plant) redirect('/')

  const photos = photosResult.rows as any[]
  const careLogs = careLogsResult.rows as any[]
  const fertLogs = fertLogsResult.rows as any[]

  // Build unified activity feed (care + fertilize)
  type ActivityItem = { date: string; label: string }
  const activity: ActivityItem[] = [
    ...careLogs.map(l => ({ date: l.logged_at as string, label: CARE_LOG_LABELS[l.type as string] ?? l.type })),
    ...fertLogs.map(l => ({ date: l.fed_at as string, label: `🌱 Fed${l.product_name ? ` (${l.product_name})` : ''}` })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)

  const waterUrgency = urgency(plant.next_watering_at as string | null)
  const repotUrgency = urgency(plant.next_repotting_at as string | null)
  const fertUrgency = urgency(plant.next_fertilizing_at as string | null)

  const soilLabel = plant.soil_type
    ? SOIL_LABELS[plant.soil_type as string] ?? (plant.mix_description as string)
    : null

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/" className="text-green-600 font-medium text-sm">← My Plants</Link>
          <Link
            href={`/plants/${params.id}/chat`}
            className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1.5 font-medium"
          >
            💬 Ask Claude
          </Link>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 pb-24 flex flex-col gap-5">
        {/* Plant name */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{plant.common_name as string}</h1>
          {plant.scientific_name && (
            <p className="text-gray-500 italic text-sm mt-0.5">{plant.scientific_name as string}</p>
          )}
        </div>

        {/* Photos */}
        {photos.length > 0 && <PhotoTimeline photos={photos} />}

        {/* Care schedule */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Care Schedule</h2>
          <div className="grid grid-cols-3 gap-2">
            {[
              { emoji: '💧', label: 'Water', last: plant.last_watered_at, next: plant.next_watering_at, u: waterUrgency },
              { emoji: '🪴', label: 'Repot', last: plant.last_repotted_at, next: plant.next_repotting_at, u: repotUrgency },
              { emoji: '🌱', label: 'Feed', last: plant.last_fertilized_at, next: plant.next_fertilizing_at, u: fertUrgency },
            ].map(({ emoji, label, last, next, u }) => (
              <div key={label} className={`rounded-2xl border p-3 text-center ${URGENCY_CLASSES[u]}`}>
                <p className="text-xl mb-1">{emoji}</p>
                <p className="text-xs font-semibold text-gray-700">{label}</p>
                <p className={`text-xs font-medium mt-1 ${URGENCY_LABEL_CLASSES[u]}`}>
                  {relativeDay(next as string | null) || fmt(next as string | null)}
                </p>
                {last && (
                  <p className="text-xs text-gray-400 mt-0.5">Last: {fmt(last as string | null)}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Log care actions */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Log Care</h2>
          <CareButtons plantId={params.id} />
        </div>

        {/* Soil info */}
        {soilLabel && (
          <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center gap-3">
            <span className="text-xl">🌍</span>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Soil</p>
              <p className="text-sm font-medium text-gray-800 mt-0.5">{soilLabel}</p>
            </div>
          </div>
        )}

        {/* Location */}
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center gap-3">
          <span className="text-xl">
            {plant.location === 'indoor' ? '🏠' : plant.location === 'outdoor' ? '🌳' : plant.location === 'balcony' ? '🌿' : '🏡'}
          </span>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</p>
            <p className="text-sm font-medium text-gray-800 capitalize mt-0.5">{plant.location as string}</p>
          </div>
        </div>

        {/* Care tip */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Care Tip</h2>
          <TipsStream plantId={params.id} />
        </div>

        {/* Recent activity */}
        {activity.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent Activity</h2>
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
              {activity.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-gray-700">{item.label}</span>
                  <span className="text-xs text-gray-400">{fmt(item.date)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat CTA */}
        <Link
          href={`/plants/${params.id}/chat`}
          className="flex items-center justify-between bg-green-600 text-white rounded-2xl px-5 py-4 hover:bg-green-700 active:scale-95 transition-all"
        >
          <div>
            <p className="font-semibold">Chat with Claude</p>
            <p className="text-green-200 text-xs mt-0.5">Ask questions about your plant</p>
          </div>
          <span className="text-2xl">💬</span>
        </Link>
      </div>
    </main>
  )
}
