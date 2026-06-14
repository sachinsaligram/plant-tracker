import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PlantEditForm } from '@/components/plant-edit-form'

type Params = { params: { id: string } }

export default async function EditPlantPage({ params }: Params) {
  const session = await auth()
  if (!session) redirect('/login')

  const db = getDb()
  const result = await db.execute({
    sql: `SELECT p.*, s.type AS soil_type
          FROM plants p
          LEFT JOIN soils s ON s.id = p.soil_id
          WHERE p.id = ? AND p.user_id = ?`,
    args: [params.id, session.user.id],
  })
  const plant = result.rows[0]
  if (!plant) redirect('/')

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href={`/plants/${params.id}`} className="text-green-600 font-medium text-sm">← Cancel</Link>
          <h1 className="font-semibold text-gray-900">Edit Plant</h1>
          <div className="w-16" />
        </div>
      </div>
      <PlantEditForm plant={{
        id: plant.id as string,
        common_name: plant.common_name as string,
        scientific_name: plant.scientific_name as string | null,
        location: plant.location as string,
        soil_type: plant.soil_type as string | null,
        watering_interval_days: plant.watering_interval_days as number,
        repotting_interval_days: plant.repotting_interval_days as number,
        fertilizing_interval_days: plant.fertilizing_interval_days as number,
        notes: plant.notes as string | null,
      }} />
    </main>
  )
}
