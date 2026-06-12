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

  const { plant_id, type, notes } = await req.json() as { plant_id: string; type: string; notes?: string }
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
    // Write to fertilizer_logs (fertilizer_id is nullable for ad-hoc logs)
    await db.execute({
      sql: `INSERT INTO fertilizer_logs (id, plant_id, fertilizer_id, fed_at, dosage, dosage_unit, notes) VALUES (?,?,?,?,?,?,?)`,
      args: [ulid(), plant_id, null, now, null, null, notes ?? null],
    })
    await db.execute({
      sql: `UPDATE plants SET last_fertilized_at = ?, next_fertilizing_at = ? WHERE id = ?`,
      args: [now, next, plant_id],
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  }

  await db.execute({
    sql: `INSERT INTO care_logs (id, plant_id, type, logged_at, notes) VALUES (?,?,?,?,?)`,
    args: [ulid(), plant_id, careType, now, notes ?? null],
  })
  await db.execute({
    sql: `UPDATE plants SET ${LAST[careType]} = ?, ${NEXT[careType]} = ? WHERE id = ?`,
    args: [now, next, plant_id],
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
