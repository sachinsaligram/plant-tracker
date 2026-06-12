import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { uploadPhoto } from '@/lib/blob'
import { ulid } from '@/lib/ulid'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const plantId = formData.get('plant_id') as string
  const isPrimary = formData.get('is_primary') === 'true' ? 1 : 0

  const blobUrl = await uploadPhoto(file, session.user.id)
  const id = ulid()
  const db = getDb()

  await db.execute({
    sql: `INSERT INTO plant_photos (id, plant_id, blob_url, is_primary) VALUES (?,?,?,?)`,
    args: [id, plantId, blobUrl, isPrimary],
  })

  return NextResponse.json({ id, blob_url: blobUrl }, { status: 201 })
}
