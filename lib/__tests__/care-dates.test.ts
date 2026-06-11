import { nextCareDate } from '@/lib/care-dates'

describe('nextCareDate', () => {
  it('adds interval days to the base date', () => {
    const result = nextCareDate('2026-06-01T00:00:00.000Z', 7)
    expect(result).toBe('2026-06-08T00:00:00.000Z')
  })

  it('returns interval days from now when base is null', () => {
    const now = new Date('2026-06-11T00:00:00.000Z')
    const result = nextCareDate(null, 14, now)
    expect(result).toBe('2026-06-25T00:00:00.000Z')
  })
})
