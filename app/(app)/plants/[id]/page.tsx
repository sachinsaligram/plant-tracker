import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { redirect } from 'next/navigation'
import { PlantDetailView, type JournalEntry } from '@/components/plant-detail-view'

type Params = { params: { id: string } }

export default async function PlantDetailPage({ params }: Params) {
  const session = await auth()
  if (!session) redirect('/login')

  const db = getDb()
  const [plantResult, journalResult, photoResult] = await Promise.all([
    db.execute({
      sql: `SELECT p.*, s.type AS soil_type, s.mix_description
            FROM plants p
            LEFT JOIN soils s ON s.id = p.soil_id
            WHERE p.id = ? AND p.user_id = ?`,
      args: [params.id, session.user.id],
    }),
    db.execute({
      sql: `SELECT id, 'water' AS event_type, logged_at AS date, notes,
                   NULL AS photo_url, NULL AS product_name, NULL AS dosage, NULL AS dosage_unit
            FROM care_logs WHERE plant_id = ? AND type = 'water'
            UNION ALL
            SELECT id, 'repot', logged_at, notes, NULL, NULL, NULL, NULL
            FROM care_logs WHERE plant_id = ? AND type = 'repot'
            UNION ALL
            SELECT fl.id, 'fertilize', fl.fed_at, fl.notes, NULL,
                   COALESCE(f.product_name, f.brand, NULL),
                   fl.dosage, fl.dosage_unit
            FROM fertilizer_logs fl
            LEFT JOIN fertilizers f ON f.id = fl.fertilizer_id
            WHERE fl.plant_id = ?
            UNION ALL
            SELECT id, 'photo', taken_at, NULL, blob_url, NULL, NULL, NULL
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

  return (
    <PlantDetailView
      plant={plant as any}
      journal={journalResult.rows as unknown as JournalEntry[]}
      primaryPhoto={(photoResult.rows[0]?.blob_url as string) ?? null}
    />
  )
}
