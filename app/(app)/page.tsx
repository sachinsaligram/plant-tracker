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
    <main className="max-w-lg mx-auto px-4 py-8 pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Plants</h1>
        <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-700">Settings</Link>
      </div>
      {plants.length === 0 ? (
        <p className="text-gray-500 text-center mt-16">No plants yet. Tap + to add one.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {plants.map(p => <PlantCard key={p.id} plant={p} />)}
        </div>
      )}
      <FAB />
    </main>
  )
}
