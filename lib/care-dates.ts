export function nextCareDate(
  lastAt: string | null,
  intervalDays: number,
  now: Date = new Date()
): string {
  const base = lastAt ? new Date(lastAt) : now
  const next = new Date(base)
  next.setDate(next.getDate() + intervalDays)
  return next.toISOString()
}
