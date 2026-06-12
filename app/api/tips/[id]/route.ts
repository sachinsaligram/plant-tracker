import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { getAnthropic } from '@/lib/anthropic'

type Params = { params: { id: string } }

function buildPrompt(plant: any): string {
  const month = new Date().toLocaleString('en-US', { month: 'long' })
  return `Give a 2-3 sentence care tip for this plant right now.

Plant: ${plant.common_name} (${plant.scientific_name ?? 'unknown'})
Location: ${plant.location} | Month: ${month}
Last watered: ${plant.last_watered_at ?? 'never'}
Last repotted: ${plant.last_repotted_at ?? 'never'}
Last fertilized: ${plant.last_fertilized_at ?? 'never'}

Be specific and actionable.`
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const db = getDb()
  const result = await db.execute({
    sql: 'SELECT * FROM plants WHERE id = ? AND user_id = ?',
    args: [params.id, session.user.id],
  })
  const plant = result.rows[0]
  if (!plant) return new Response('Not found', { status: 404 })

  const anthropic = getAnthropic()
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{ role: 'user', content: buildPrompt(plant) }],
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
        }
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
