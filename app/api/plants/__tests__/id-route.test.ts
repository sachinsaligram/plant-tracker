import { GET, PATCH, DELETE } from '../[id]/route'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}))

jest.mock('@/lib/db', () => {
  const mockExecute = jest.fn()
  return { getDb: jest.fn().mockReturnValue({ execute: mockExecute }), mockExecute }
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mockExecute } = require('@/lib/db') as { mockExecute: jest.Mock }

const plant = { id: 'p1', user_id: 'user-1', common_name: 'Monstera' }

describe('GET /api/plants/[id]', () => {
  it('returns 404 when plant not owned by user', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] })
    const req = new Request('http://localhost/api/plants/p1')
    const res = await GET(req, { params: { id: 'p1' } })
    expect(res.status).toBe(404)
  })

  it('returns plant when found', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [plant] })
    const req = new Request('http://localhost/api/plants/p1')
    const res = await GET(req, { params: { id: 'p1' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.common_name).toBe('Monstera')
  })
})

describe('DELETE /api/plants/[id]', () => {
  it('returns 204 on success', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [plant] })
      .mockResolvedValueOnce({ rows: [] })
    const req = new Request('http://localhost/api/plants/p1', { method: 'DELETE' })
    const res = await DELETE(req, { params: { id: 'p1' } })
    expect(res.status).toBe(204)
  })
})
