import { POST } from '../route'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}))
jest.mock('@vercel/blob', () => ({
  put: jest.fn().mockResolvedValue({ url: 'https://blob.vercel.com/test.jpg' }),
}))
jest.mock('@/lib/db', () => ({
  getDb: jest.fn().mockReturnValue({ execute: jest.fn().mockResolvedValue({ rows: [] }) }),
}))

describe('POST /api/photos', () => {
  it('returns blob_url and 201 on success', async () => {
    const formData = new FormData()
    formData.append('plant_id', 'p1')
    formData.append('file', new Blob(['fake'], { type: 'image/jpeg' }), 'photo.jpg')
    formData.append('is_primary', 'true')
    const req = new Request('http://localhost/api/photos', { method: 'POST', body: formData })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.blob_url).toBe('https://blob.vercel.com/test.jpg')
  })
})
