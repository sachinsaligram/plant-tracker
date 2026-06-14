import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { ulid } from '@/lib/ulid'

type Params = { params: { id: string } }

async function getOwnedPlant(plantId: string, userId: string) {
  const db = getDb()
  const result = await db.execute({
    sql: 'SELECT * FROM plants WHERE id = ? AND user_id = ?',
    args: [plantId, userId],
  })
  return result.rows[0] ?? null
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const plant = await getOwnedPlant(params.id, session.user.id)
  if (!plant) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(plant)
}

const VALID_SOIL_TYPES = ['potting mix', 'cactus mix', 'orchid mix', 'custom'] as const

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const plant = await getOwnedPlant(params.id, session.user.id)
  if (!plant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const db = getDb()

  // Handle soil_type: update existing or create new soil record
  if (body.soil_type !== undefined) {
    const soilType = (VALID_SOIL_TYPES as readonly string[]).includes(body.soil_type)
      ? body.soil_type
      : 'custom'
    if (plant.soil_id) {
      await db.execute({
        sql: 'UPDATE soils SET type = ?, mix_description = ? WHERE id = ?',
        args: [soilType, body.soil_type, plant.soil_id],
      })
    } else {
      const soilId = ulid()
      await db.execute({
        sql: 'INSERT INTO soils (id, user_id, type, mix_description) VALUES (?,?,?,?)',
        args: [soilId, session.user.id, soilType, body.soil_type],
      })
      body.soil_id = soilId
    }
  }

  const allowed = [
    'common_name', 'scientific_name', 'soil_id', 'location', 'notes',
    'watering_interval_days', 'repotting_interval_days', 'fertilizing_interval_days',
    'last_watered_at', 'last_repotted_at', 'last_fertilized_at',
    'next_watering_at', 'next_repotting_at', 'next_fertilizing_at',
  ]
  const fields = Object.keys(body).filter(k => allowed.includes(k))
  if (fields.length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 })

  const setClauses = fields.map(f => `${f} = ?`).join(', ')
  await db.execute({
    sql: `UPDATE plants SET ${setClauses} WHERE id = ?`,
    args: [...fields.map(f => body[f]), params.id],
  })

  const updated = await db.execute({ sql: 'SELECT * FROM plants WHERE id = ?', args: [params.id] })
  return NextResponse.json(updated.rows[0])
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const plant = await getOwnedPlant(params.id, session.user.id)
  if (!plant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const db = getDb()
  await db.execute({ sql: 'DELETE FROM plants WHERE id = ?', args: [params.id] })
  return new Response(null, { status: 204 })
}
