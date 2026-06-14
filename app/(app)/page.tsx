import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { redirect } from 'next/navigation'
import { FeedView } from '@/components/feed-view'

export default async function FeedPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const db = getDb()
  const result = await db.execute({
    sql: `SELECT p.id, p.common_name, p.scientific_name, p.location,
                 p.next_watering_at, p.next_repotting_at, p.next_fertilizing_at,
                 p.last_watered_at, p.last_repotted_at, p.last_fertilized_at,
                 pp.blob_url AS primary_photo
          FROM plants p
          LEFT JOIN plant_photos pp ON pp.plant_id = p.id AND pp.is_primary = 1
          WHERE p.user_id = ?
          ORDER BY COALESCE(
            MIN(p.next_watering_at, p.next_repotting_at, p.next_fertilizing_at),
            p.created_at
          ) ASC`,
    args: [session.user.id],
  })

  return <FeedView plants={result.rows as any} />
}
