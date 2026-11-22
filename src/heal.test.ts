import { beforeEach, describe, expect, it } from 'vitest'
import { CORE } from './data'
import { addDays, localISO } from './dates'
import { settleDay } from './habit'
import { dueCount, graduate } from './srs'
import { fresh, replace, S } from './state'

const day = (offset: number) => addDays(localISO(), offset)

beforeEach(() => replace(fresh()))

describe('stuck-day heal and dueCount', () => {
  it('heals a stuck day whose words are all learned and advances on the next calendar day', () => {
    for (const c of CORE.filter((c) => c.day <= 1)) graduate(c.id, 0)
    settleDay()
    expect(S.dayDoneOn[1]).toBe(localISO())
    expect(S.dayIdx).toBe(1)

    S.dayDoneOn[1] = day(-1)
    settleDay()
    expect(S.dayIdx).toBe(2)
  })

  it('does not heal a day when only some of its cards are learned', () => {
    for (const c of CORE.filter((c) => c.day === 1).slice(0, 5)) graduate(c.id, 0)
    settleDay()
    expect(S.dayDoneOn[1]).toBeUndefined()
  })

  it('counts cards due today vs tomorrow with dueCount', () => {
    for (const c of CORE.filter((c) => c.day === 1)) graduate(c.id, 0)
    expect(dueCount(0)).toBe(0)
    expect(dueCount(1)).toBe(10)
  })
})
