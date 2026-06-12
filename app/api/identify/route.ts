import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getAnthropic } from '@/lib/anthropic'

const SYSTEM = `You are a plant identification expert. Given a photo, return ONLY a JSON object (no markdown) with:
- common_name: string
- scientific_name: string
- watering_interval_days: number
- repotting_interval_days: number
- fertilizing_interval_days: number
- suggested_soil_type: "potting mix" | "cactus mix" | "orchid mix" | "custom"
- location_preference: "indoor" | "outdoor" | "balcony" | "greenhouse"`

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { image } = await req.json()
  const [header, base64Data] = image.split(',')
  const mediaType = header.match(/data:([^;]+)/)?.[1] as 'image/jpeg' | 'image/png' | 'image/webp'

  const anthropic = getAnthropic()
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
        { type: 'text', text: 'Identify this plant.' },
      ],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return NextResponse.json(JSON.parse(text))
  } catch {
    return NextResponse.json({ error: 'Failed to parse Claude response', raw: text }, { status: 500 })
  }
}
