const DAY = 86400000
export function localISO(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const parseISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) }
export const addDays = (s: string, n: number) => new Date(parseISO(s) + n * DAY).toISOString().slice(0, 10)
export const daysBetween = (a: string, b: string) => Math.round((parseISO(b) - parseISO(a)) / DAY)
export const weekdayShort = (s: string) => new Date(parseISO(s)).toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' })
