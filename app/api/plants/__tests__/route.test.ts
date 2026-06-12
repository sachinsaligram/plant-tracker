import { GET, POST } from '../route'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'user-1', email: 'a@b.com' } }),
}))

jest.mock('@/lib/db', () => {
  const mockExecute = jest.fn()
  return { getDb: jest.fn().mockReturnValue({ execute: mockExecute }), mockExecute }
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mockExecute } = require('@/lib/db') as { mockExecute: jest.Mock }

describe('GET /api/plants', () => {
  it('returns plants for authenticated user', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ id: 'p1', common_name: 'Monstera', user_id: 'user-1', primary_photo: null }],
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].common_name).toBe('Monstera')
  })
})

describe('POST /api/plants', () => {
  it('creates a plant and returns 201', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'p2', common_name: 'Pothos' }] })
    const req = new Request('http://localhost/api/plants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        common_name: 'Pothos',
        scientific_name: 'Epipremnum aureum',
        location: 'indoor',
        watering_interval_days: 7,
        repotting_interval_days: 365,
        fertilizing_interval_days: 30,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.common_name).toBe('Pothos')
  })
})
