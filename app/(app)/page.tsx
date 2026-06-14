import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PlantCard } from '@/components/plant-card'
import { FAB } from '@/components/fab'

function daysDiff(d: string | null | undefined): number | null {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
}

export default async function FeedPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const db = getDb()
  const result = await db.execute({
    sql: `SELECT p.*, pp.blob_url AS primary_photo
          FROM plants p
          LEFT JOIN plant_photos pp ON pp.plant_id = p.id AND pp.is_primary = 1
          WHERE p.user_id = ?
          ORDER BY p.next_watering_at ASC`,
    args: [session.user.id],
  })
  const plants = result.rows as any[]

  // Compute status summary
  const overdueWater = plants.filter(p => {
    const d = daysDiff(p.next_watering_at)
    return d !== null && d < 0
  }).length
  const needsWaterToday = plants.filter(p => {
    const d = daysDiff(p.next_watering_at)
    return d !== null && d === 0
  }).length
  const overdueTotal = plants.filter(p => {
    return (
      (daysDiff(p.next_watering_at) ?? 1) < 0 ||
      (daysDiff(p.next_repotting_at) ?? 1) < 0 ||
      (daysDiff(p.next_fertilizing_at) ?? 1) < 0
    )
  }).length

  let summaryText: string | null = null
  let summaryClass = ''
  if (overdueTotal > 0) {
    summaryText = `${overdueTotal} plant${overdueTotal !== 1 ? 's' : ''} need${overdueTotal === 1 ? 's' : ''} attention now`
    summaryClass = 'bg-red-50 border-red-200 text-red-700'
  } else if (overdueWater + needsWaterToday > 0) {
    summaryText = `${overdueWater + needsWaterToday} plant${overdueWater + needsWaterToday !== 1 ? 's' : ''} need${overdueWater + needsWaterToday === 1 ? 's' : ''} water today`
    summaryClass = 'bg-amber-50 border-amber-200 text-amber-700'
  } else if (plants.length > 0) {
    summaryText = 'All plants are on track 🎉'
    summaryClass = 'bg-green-50 border-green-200 text-green-700'
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            <h1 className="text-xl font-bold text-gray-900">My Plants</h1>
          </div>
          <Link
            href="/settings"
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
            aria-label="Settings"
          >
            ⚙️
          </Link>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 pb-28">
        {plants.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center pt-20 gap-6">
            <div className="text-8xl">🪴</div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">No plants yet</h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                Photograph a plant and Claude will identify it,<br />
                then track watering, repotting, and fertilizing for you.
              </p>
            </div>
            <Link
              href="/plants/new"
              className="bg-green-600 text-white px-6 py-3 rounded-full font-medium text-sm hover:bg-green-700 transition-colors shadow-sm"
            >
              + Add your first plant
            </Link>
          </div>
        ) : (
          <>
            {summaryText && (
              <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-medium ${summaryClass}`}>
                {summaryText}
              </div>
            )}
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
              {plants.length} plant{plants.length !== 1 ? 's' : ''} · sorted by next watering
            </p>
            <div className="flex flex-col gap-3">
              {plants.map(p => <PlantCard key={p.id} plant={p} />)}
            </div>
          </>
        )}
      </div>

      <FAB />
    </main>
  )
}
