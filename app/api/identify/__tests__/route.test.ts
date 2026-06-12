// eslint-disable-next-line no-var
var mockCreate = jest.fn()

jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}))

jest.mock('@/lib/anthropic', () => ({
  getAnthropic: jest.fn().mockReturnValue({ messages: { create: mockCreate } }),
}))

import { POST } from '../route'

describe('POST /api/identify', () => {
  beforeEach(() => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          common_name: 'Monstera',
          scientific_name: 'Monstera deliciosa',
          watering_interval_days: 7,
          repotting_interval_days: 365,
          fertilizing_interval_days: 30,
          suggested_soil_type: 'potting mix',
          location_preference: 'indoor',
        }),
      }],
    })
  })

  it('returns structured plant data from Claude', async () => {
    const req = new Request('http://localhost/api/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'data:image/jpeg;base64,/9j/abc123' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.common_name).toBe('Monstera')
    expect(body.watering_interval_days).toBe(7)
  })
})
