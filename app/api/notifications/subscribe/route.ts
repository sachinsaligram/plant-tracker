import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { ulid } from '@/lib/ulid'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint, keys }: { endpoint: string; keys: { p256dh: string; auth: string } } = await req.json()
  const db = getDb()

  await db.execute({
    sql: `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
          VALUES (?,?,?,?,?)
          ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id`,
    args: [ulid(), session.user.id, endpoint, keys.p256dh, keys.auth],
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
