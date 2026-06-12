import { POST } from '../[id]/route'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}))
jest.mock('@/lib/db', () => ({
  getDb: jest.fn().mockReturnValue({
    execute: jest.fn().mockResolvedValue({
      rows: [{ id: 'p1', user_id: 'user-1', common_name: 'Monstera', scientific_name: null, location: 'indoor', last_watered_at: null, last_fertilized_at: null }],
    }),
  }),
}))

jest.mock('@/lib/anthropic', () => {
  const mockStream = {
    async *[Symbol.asyncIterator]() {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Water every 7 days.' } }
    },
  }
  return {
    getAnthropic: jest.fn().mockReturnValue({ messages: { stream: jest.fn().mockReturnValue(mockStream) } }),
  }
})

describe('POST /api/chat/[id]', () => {
  it('returns 200 with text/event-stream', async () => {
    const req = new Request('http://localhost/api/chat/p1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'How often do I water?' }] }),
    })
    const res = await POST(req, { params: { id: 'p1' } })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')
  })
})
