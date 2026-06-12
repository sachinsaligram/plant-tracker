import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { ulid } from '@/lib/ulid'
import { nextCareDate } from '@/lib/care-dates'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const result = await db.execute({
    sql: `SELECT p.*, pp.blob_url AS primary_photo
          FROM plants p
          LEFT JOIN plant_photos pp ON pp.plant_id = p.id AND pp.is_primary = 1
          WHERE p.user_id = ?
          ORDER BY p.next_watering_at ASC`,
    args: [session.user.id],
  })
  return NextResponse.json(result.rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const id = ulid()
  const now = new Date().toISOString()
  const db = getDb()

  await db.execute({
    sql: `INSERT INTO plants (
            id, user_id, common_name, scientific_name, soil_id, location,
            watering_interval_days, repotting_interval_days, fertilizing_interval_days,
            next_watering_at, next_repotting_at, next_fertilizing_at, notes, created_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      id, session.user.id, body.common_name, body.scientific_name ?? null,
      body.soil_id ?? null, body.location,
      body.watering_interval_days, body.repotting_interval_days, body.fertilizing_interval_days,
      nextCareDate(null, body.watering_interval_days),
      nextCareDate(null, body.repotting_interval_days),
      nextCareDate(null, body.fertilizing_interval_days),
      body.notes ?? null, now,
    ],
  })

  const plant = await db.execute({ sql: 'SELECT * FROM plants WHERE id = ?', args: [id] })
  return NextResponse.json(plant.rows[0], { status: 201 })
}
