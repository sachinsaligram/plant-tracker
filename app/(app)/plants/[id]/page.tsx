import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TipsStream } from '@/components/tips-stream'
import { PhotoTimeline } from '@/components/photo-timeline'
import { CareButtons } from '@/components/care-buttons'

type Params = { params: { id: string } }

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '—'

export default async function PlantDetailPage({ params }: Params) {
  const session = await auth()
  if (!session) redirect('/login')

  const db = getDb()
  const [plantResult, photosResult] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM plants WHERE id = ? AND user_id = ?', args: [params.id, session.user.id] }),
    db.execute({ sql: 'SELECT * FROM plant_photos WHERE plant_id = ? ORDER BY taken_at ASC', args: [params.id] }),
  ])

  const plant = plantResult.rows[0]
  if (!plant) redirect('/')
  const photos = photosResult.rows as any[]

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <Link href="/" className="text-green-600 text-sm mb-4 block">← Back</Link>
      <h1 className="text-2xl font-bold mb-1">{plant.common_name as string}</h1>
      {plant.scientific_name && (
        <p className="text-gray-500 italic text-sm mb-4">{plant.scientific_name as string}</p>
      )}

      <PhotoTimeline photos={photos} />

      <div className="mt-6 grid grid-cols-3 gap-3 text-center text-sm">
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-blue-700 font-medium">Next water</p>
          <p className="text-gray-700">{fmt(plant.next_watering_at as string)}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-3">
          <p className="text-yellow-800 font-medium">Next repot</p>
          <p className="text-gray-700">{fmt(plant.next_repotting_at as string)}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3">
          <p className="text-green-700 font-medium">Next feed</p>
          <p className="text-gray-700">{fmt(plant.next_fertilizing_at as string)}</p>
        </div>
      </div>

      <div className="mt-6">
        <CareButtons plantId={params.id} />
      </div>

      <div className="mt-6">
        <h2 className="font-semibold text-gray-800 mb-2">Care Tip</h2>
        <TipsStream plantId={params.id} />
      </div>

      <div className="mt-6">
        <Link
          href={`/plants/${params.id}/chat`}
          className="block w-full text-center py-3 border border-green-600 text-green-600 rounded-xl hover:bg-green-50"
        >
          Chat about this plant →
        </Link>
      </div>
    </main>
  )
}
