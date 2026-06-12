import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { getAnthropic } from '@/lib/anthropic'

type Params = { params: { id: string } }
type Message = { role: 'user' | 'assistant'; content: string }

function buildSystem(plant: any): string {
  const month = new Date().toLocaleString('en-US', { month: 'long' })
  return `You are a plant care assistant specializing in ${plant.common_name}${plant.scientific_name ? ` (${plant.scientific_name})` : ''}.
Location: ${plant.location} | Month: ${month}
Last watered: ${plant.last_watered_at ?? 'never'} | Last fertilized: ${plant.last_fertilized_at ?? 'never'}
Answer questions about this plant concisely and helpfully.`
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const db = getDb()
  const result = await db.execute({
    sql: 'SELECT * FROM plants WHERE id = ? AND user_id = ?',
    args: [params.id, session.user.id],
  })
  const plant = result.rows[0]
  if (!plant) return new Response('Not found', { status: 404 })

  const { messages }: { messages: Message[] } = await req.json()
  const anthropic = getAnthropic()
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: buildSystem(plant),
    messages,
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
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
