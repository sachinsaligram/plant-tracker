import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PlantCard } from '@/components/plant-card'
import { FAB } from '@/components/fab'

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
            <p className="text-xs text-gray-600 font-medium uppercase tracking-wider mb-3">
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
