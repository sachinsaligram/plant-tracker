import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getAnthropic } from '@/lib/anthropic'
import { sendPush } from '@/lib/push'

const NUDGE_SYSTEM = `You are a plant care assistant. Given a plant due for care, return ONLY a JSON object:
{"adjusted_days": number, "notification_body": string}
adjusted_days: -2 to 2 (0 = no change, based on season/species)
notification_body: max 100 chars, actionable`

async function getNudge(plant: any): Promise<{ adjusted_days: number; notification_body: string }> {
  const month = new Date().toLocaleString('en-US', { month: 'long' })
  const anthropic = getAnthropic()
  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 128,
      system: NUDGE_SYSTEM,
      messages: [{ role: 'user', content: `Plant: ${plant.common_name}, Location: ${plant.location}, Month: ${month}` }],
    })
    const text = res.content[0].type === 'text' ? res.content[0].text : '{}'
    return JSON.parse(text)
  } catch {
    return { adjusted_days: 0, notification_body: `Time to care for your ${plant.common_name}` }
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()
  const today = new Date().toISOString().slice(0, 10)

  const dueResult = await db.execute({
    sql: `SELECT * FROM plants WHERE date(next_watering_at) <= date(?)
          OR date(next_repotting_at) <= date(?)
          OR date(next_fertilizing_at) <= date(?)`,
    args: [today, today, today],
  })

  let processed = 0
  for (const plant of dueResult.rows) {
    const nudge = await getNudge(plant)

    const subsResult = await db.execute({
      sql: 'SELECT * FROM push_subscriptions WHERE user_id = ?',
      args: [plant.user_id],
    })

    for (const sub of subsResult.rows) {
      await sendPush(
        { endpoint: sub.endpoint as string, p256dh: sub.p256dh as string, auth: sub.auth as string },
        { title: `${plant.common_name} needs attention`, body: nudge.notification_body, url: `/plants/${plant.id}` }
      ).catch(() => {})
    }

    if (nudge.adjusted_days !== 0) {
      const adjusted = new Date(today)
      adjusted.setDate(adjusted.getDate() + nudge.adjusted_days)
      const iso = adjusted.toISOString()
      const update: string[] = []
      const args: any[] = []
      if ((plant.next_watering_at as string | null)?.startsWith(today)) { update.push('next_watering_at = ?'); args.push(iso) }
      if ((plant.next_repotting_at as string | null)?.startsWith(today)) { update.push('next_repotting_at = ?'); args.push(iso) }
      if ((plant.next_fertilizing_at as string | null)?.startsWith(today)) { update.push('next_fertilizing_at = ?'); args.push(iso) }
      if (update.length > 0) {
        await db.execute({ sql: `UPDATE plants SET ${update.join(', ')} WHERE id = ?`, args: [...args, plant.id] })
      }
    }
    processed++
  }

  return NextResponse.json({ processed })
}
