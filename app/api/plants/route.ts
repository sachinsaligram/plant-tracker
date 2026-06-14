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

const VALID_SOIL_TYPES = ['potting mix', 'cactus mix', 'orchid mix', 'custom'] as const
type SoilType = typeof VALID_SOIL_TYPES[number]

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const id = ulid()
  const now = new Date().toISOString()
  const db = getDb()

  // Create a soil record if soil type was provided
  let soilId: string | null = body.soil_id ?? null
  const soilType = body.soil_type as string | undefined
  if (soilType && !soilId) {
    const resolvedType: SoilType = (VALID_SOIL_TYPES as readonly string[]).includes(soilType)
      ? soilType as SoilType
      : 'custom'
    soilId = ulid()
    await db.execute({
      sql: `INSERT INTO soils (id, user_id, type, mix_description) VALUES (?,?,?,?)`,
      args: [soilId, session.user.id, resolvedType, soilType],
    })
  }

  await db.execute({
    sql: `INSERT INTO plants (
            id, user_id, common_name, scientific_name, soil_id, location,
            watering_interval_days, repotting_interval_days, fertilizing_interval_days,
            next_watering_at, next_repotting_at, next_fertilizing_at, notes, created_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      id, session.user.id, body.common_name, body.scientific_name ?? null,
      soilId, body.location,
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
