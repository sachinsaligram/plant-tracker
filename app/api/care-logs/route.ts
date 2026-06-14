import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { ulid } from '@/lib/ulid'
import { nextCareDate } from '@/lib/care-dates'

type CareType = 'water' | 'repot' | 'fertilize'

const INTERVAL: Record<CareType, string> = {
  water: 'watering_interval_days',
  repot: 'repotting_interval_days',
  fertilize: 'fertilizing_interval_days',
}
const LAST: Record<CareType, string> = {
  water: 'last_watered_at',
  repot: 'last_repotted_at',
  fertilize: 'last_fertilized_at',
}
const NEXT: Record<CareType, string> = {
  water: 'next_watering_at',
  repot: 'next_repotting_at',
  fertilize: 'next_fertilizing_at',
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    plant_id: string
    type: string
    notes?: string
    product_name?: string
    dosage?: number
    dosage_unit?: string
    soil_type?: string
  }
  const { plant_id, type, notes, product_name, dosage, dosage_unit, soil_type } = body

  if (!['water', 'repot', 'fertilize'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  const careType = type as CareType

  const db = getDb()
  const plantResult = await db.execute({
    sql: 'SELECT * FROM plants WHERE id = ? AND user_id = ?',
    args: [plant_id, session.user.id],
  })
  const plant = plantResult.rows[0]
  if (!plant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const now = new Date().toISOString()
  const interval = plant[INTERVAL[careType]] as number
  const next = nextCareDate(now, interval)

  if (careType === 'fertilize') {
    // Find or create fertilizer record if product_name is provided
    let fertilizerId: string | null = null
    if (product_name?.trim()) {
      const existing = await db.execute({
        sql: 'SELECT id FROM fertilizers WHERE user_id = ? AND product_name = ? LIMIT 1',
        args: [session.user.id, product_name.trim()],
      })
      if (existing.rows[0]) {
        fertilizerId = existing.rows[0].id as string
      } else {
        fertilizerId = ulid()
        await db.execute({
          sql: 'INSERT INTO fertilizers (id, user_id, product_name, type) VALUES (?,?,?,?)',
          args: [fertilizerId, session.user.id, product_name.trim(), 'liquid'],
        })
      }
    }

    await db.execute({
      sql: `INSERT INTO fertilizer_logs (id, plant_id, fertilizer_id, fed_at, dosage, dosage_unit, notes)
            VALUES (?,?,?,?,?,?,?)`,
      args: [ulid(), plant_id, fertilizerId, now, dosage ?? null, dosage_unit ?? null, notes ?? null],
    })
    await db.execute({
      sql: `UPDATE plants SET last_fertilized_at = ?, next_fertilizing_at = ? WHERE id = ?`,
      args: [now, next, plant_id],
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  }

  // water or repot
  await db.execute({
    sql: `INSERT INTO care_logs (id, plant_id, type, logged_at, notes) VALUES (?,?,?,?,?)`,
    args: [ulid(), plant_id, careType, now, notes ?? null],
  })
  await db.execute({
    sql: `UPDATE plants SET ${LAST[careType]} = ?, ${NEXT[careType]} = ? WHERE id = ?`,
    args: [now, next, plant_id],
  })

  // If repotting and a new soil type provided, update the plant's soil
  if (careType === 'repot' && soil_type?.trim()) {
    const VALID_SOIL_TYPES = ['potting mix', 'cactus mix', 'orchid mix', 'custom']
    const resolvedType = VALID_SOIL_TYPES.includes(soil_type) ? soil_type : 'custom'
    if (plant.soil_id) {
      await db.execute({
        sql: 'UPDATE soils SET type = ?, mix_description = ? WHERE id = ?',
        args: [resolvedType, soil_type, plant.soil_id],
      })
    } else {
      const soilId = ulid()
      await db.execute({
        sql: 'INSERT INTO soils (id, user_id, type, mix_description) VALUES (?,?,?,?)',
        args: [soilId, session.user.id, resolvedType, soil_type],
      })
      await db.execute({
        sql: 'UPDATE plants SET soil_id = ? WHERE id = ?',
        args: [soilId, plant_id],
      })
    }
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, entry_type } = await req.json() as { id: string; entry_type: string }
  const db = getDb()

  if (entry_type === 'water' || entry_type === 'repot') {
    const result = await db.execute({
      sql: `SELECT cl.id FROM care_logs cl
            JOIN plants p ON p.id = cl.plant_id
            WHERE cl.id = ? AND p.user_id = ?`,
      args: [id, session.user.id],
    })
    if (!result.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await db.execute({ sql: 'DELETE FROM care_logs WHERE id = ?', args: [id] })

  } else if (entry_type === 'fertilize') {
    const result = await db.execute({
      sql: `SELECT fl.id FROM fertilizer_logs fl
            JOIN plants p ON p.id = fl.plant_id
            WHERE fl.id = ? AND p.user_id = ?`,
      args: [id, session.user.id],
    })
    if (!result.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await db.execute({ sql: 'DELETE FROM fertilizer_logs WHERE id = ?', args: [id] })

  } else if (entry_type === 'photo') {
    const result = await db.execute({
      sql: `SELECT pp.id FROM plant_photos pp
            JOIN plants p ON p.id = pp.plant_id
            WHERE pp.id = ? AND p.user_id = ?`,
      args: [id, session.user.id],
    })
    if (!result.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await db.execute({ sql: 'DELETE FROM plant_photos WHERE id = ?', args: [id] })

  } else {
    return NextResponse.json({ error: 'Invalid entry_type' }, { status: 400 })
  }

  return new Response(null, { status: 204 })
}
