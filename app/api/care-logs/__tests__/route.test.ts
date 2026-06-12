import { POST } from '../route'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}))

jest.mock('@/lib/db', () => {
  const mockExecute = jest.fn()
  return { getDb: jest.fn().mockReturnValue({ execute: mockExecute }), mockExecute }
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mockExecute } = require('@/lib/db') as { mockExecute: jest.Mock }

describe('POST /api/care-logs', () => {
  beforeEach(() => mockExecute.mockReset())

  it('logs a water event and returns 201', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: 'p1', user_id: 'user-1', watering_interval_days: 7 }] }) // fetch plant
      .mockResolvedValueOnce({ rows: [] }) // insert care_log
      .mockResolvedValueOnce({ rows: [] }) // update plant
    const req = new Request('http://localhost/api/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant_id: 'p1', type: 'water' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('logs a fertilize event into fertilizer_logs and returns 201', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: 'p1', user_id: 'user-1', fertilizing_interval_days: 30 }] }) // fetch plant
      .mockResolvedValueOnce({ rows: [] }) // insert fertilizer_log
      .mockResolvedValueOnce({ rows: [] }) // update plant
    const req = new Request('http://localhost/api/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant_id: 'p1', type: 'fertilize' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 400 for invalid type', async () => {
    const req = new Request('http://localhost/api/care-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant_id: 'p1', type: 'prune' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
