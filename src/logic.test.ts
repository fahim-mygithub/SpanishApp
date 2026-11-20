import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fresh, merge, replace, S } from './state'
import { addDays, localISO } from './dates'
import { settleDay, streak } from './habit'
import { checkTyped } from './ui'
import { dueCards, graduate, newCardsUpTo, review } from './srs'

const day = (offset: number) => addDays(localISO(), offset)
const log = (sec: number) => ({ sec, xp: 0, learned: 0, reviewed: 0, inputMin: 0 })

beforeEach(() => replace(fresh()))

describe('streaks', () => {
  it('counts consecutive 5-minute days and survives today not done yet', () => {
    for (let i = -3; i <= -1; i++) S.log[day(i)] = log(300)
    expect(streak().streak).toBe(3)
    expect(streak().todayCounted).toBe(false)
    S.log[day(0)] = log(310)
    expect(streak().streak).toBe(4)
  })
  it('a short session does not count but 10 min of listening does', () => {
    S.log[day(0)] = log(120); expect(streak().todayCounted).toBe(false)
    S.log[day(0)].inputMin = 10; expect(streak().todayCounted).toBe(true)
  })
  it('earns a freeze after 7 days that covers one missed day', () => {
    for (let i = -10; i <= -4; i++) S.log[day(i)] = log(300) // 7 days
    S.log[day(-2)] = log(300); S.log[day(-1)] = log(300)       // day -3 missed
    const st = streak()
    expect(st.frozen.has(day(-3))).toBe(true)
    expect(st.streak).toBe(9)
    expect(st.freezes).toBe(0)
  })
  it('resets without a freeze, and reports days away', () => {
    S.log[day(-5)] = log(300)
    const st = streak(); expect(st.streak).toBe(0); expect(st.daysAway).toBe(5)
  })
})

describe('progress-based plan', () => {
  it('only moves on after the day is finished, never by calendar', () => {
    S.dayIdx = 9; settleDay(); expect(S.dayIdx).toBe(9)
    S.dayDoneOn[9] = day(-20); settleDay(); expect(S.dayIdx).toBe(10)
    S.dayDoneOn[10] = day(0); settleDay(); expect(S.dayIdx).toBe(10)
  })
  it('new words include skipped earlier days', () => {
    S.dayIdx = 2; expect(newCardsUpTo(2).length).toBe(20)
  })
})

describe('FSRS', () => {
  it('new words come back tomorrow, forgotten ones the same day', () => {
    graduate('c1-0', 0)
    expect(dueCards().map((c) => c.id)).not.toContain('c1-0')
    vi.useFakeTimers(); vi.setSystemTime(new Date(Date.now() + 1 * 86400000))
    expect(dueCards().map((c) => c.id)).toContain('c1-0')
    review('c1-0', 'forgot')
    expect(dueCards().map((c) => c.id)).toContain('c1-0')
    vi.useRealTimers()
  })
})

describe('merge', () => {
  it('keeps the newest of each item from both devices', () => {
    const a = fresh(), b = fresh()
    a.done['1-in'] = 100; b.done['1-in'] = -200; b.done['1-lt'] = 50
    a.log['2026-11-01'] = log(100); b.log['2026-11-01'] = log(400)
    a.dayIdx = 5; b.dayIdx = 7
    const m = merge(a, b)
    expect(m.done['1-in']).toBe(-200); expect(m.done['1-lt']).toBe(50)
    expect(m.log['2026-11-01'].sec).toBe(400); expect(m.dayIdx).toBe(7)
  })
})

describe('typed answers', () => {
  it('accepts missing accents, gives partial credit for one typo', () => {
    expect(checkTyped('tambien', 'también')).toBe('right')
    expect(checkTyped('el', 'el / la')).toBe('right')
    expect(checkTyped('ventena', 'ventana')).toBe('almost')
    expect(checkTyped('perro', 'gato')).toBe('wrong')
  })
})
