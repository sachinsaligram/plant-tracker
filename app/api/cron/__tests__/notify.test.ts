jest.mock('@/lib/db', () => ({ getDb: jest.fn().mockReturnValue({ execute: jest.fn() }) }))
jest.mock('@/lib/push', () => ({ sendPush: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/anthropic', () => ({
  getAnthropic: jest.fn().mockReturnValue({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({ adjusted_days: 0, notification_body: 'Time to water!' }) }],
      }),
    },
  }),
}))

import { GET } from '../notify/route'
import { getDb } from '@/lib/db'
import { sendPush } from '@/lib/push'

describe('GET /api/cron/notify', () => {
  beforeEach(() => {
    const mockExecute = (getDb() as any).execute as jest.Mock
    mockExecute.mockReset()
  })

  it('returns 200 with count of processed plants', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const mockExecute = (getDb() as any).execute as jest.Mock
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: 'p1', user_id: 'u1', common_name: 'Monstera', location: 'indoor', next_watering_at: today }] })
      .mockResolvedValueOnce({ rows: [{ endpoint: 'https://push.example.com', p256dh: 'k', auth: 'a' }] })
    const req = new Request('http://localhost/api/cron/notify')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(1)
  })
})
