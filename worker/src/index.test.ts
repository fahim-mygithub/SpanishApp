import { describe, expect, it } from 'vitest'
import { isDue, localNow, pickMessage, type Sub } from './index'

const base = (o: Partial<Sub> = {}): Sub => ({ sub: { endpoint: 'https://example.com/x', expirationTime: null, keys: { auth: 'a', p256dh: 'b' } }, remindAt: '19:30', tz: 'America/New_York', created: 0, ...o })
// 2026-11-20 19:45 in New York = 00:45 UTC next day
const at = new Date('2026-11-21T00:45:00Z')

describe('timing', () => {
  it('uses the subscriber’s own time zone', () => { expect(localNow('America/New_York', at)).toEqual({ date: '2026-11-20', minutes: 19 * 60 + 45 }) })
  it('fires after the reminder time, once a day', () => {
    expect(isDue(base(), at)).toBe(true)
    expect(isDue(base({ lastSent: '2026-11-20' }), at)).toBe(false)
    expect(isDue(base({ remindAt: '20:00' }), at)).toBe(false)
  })
  it('skips when the day already counts', () => { expect(isDue(base({ lastDone: '2026-11-20' }), at)).toBe(false) })
  it('never fires hours late', () => { expect(isDue(base({ remindAt: '08:00' }), at)).toBe(false) })
})

describe('messages', () => {
  it('reassures after a break instead of guilting', () => { expect(pickMessage(base({ lastDone: '2026-11-10', day: 9 }), '2026-11-20').body).toMatch(/No catching up/) })
  it('mentions an active streak', () => { expect(pickMessage(base({ lastDone: '2026-11-19', streak: 6 }), '2026-11-20').title).toBe('6-day streak') })
})

