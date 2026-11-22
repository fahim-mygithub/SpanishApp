// Habit loop: what counts as a day, streaks with freezes, XP, milestones.
// Everything here is derived from the day log, so phone and laptop always agree after a sync.
import { dayAt, TOTAL_DAYS } from './data'
import { addDays, daysBetween, localISO } from './dates'
import { S, save } from './state'
import { known, newCardsUpTo } from './srs'

export const MIN_SECONDS = 300 // the 5-minute minimum day
export const MIN_INPUT = 10    // or 10 minutes of listening
const MAX_FREEZES = 2

export function counted(date: string): boolean {
  const l = S.log[date]
  if (Object.values(S.dayDoneOn).includes(date)) return true
  return !!l && (l.sec >= MIN_SECONDS || l.inputMin >= MIN_INPUT)
}

export interface Streak { streak: number; best: number; freezes: number; frozen: Set<string>; todayCounted: boolean; daysAway: number }

export function streak(): Streak {
  const t = localISO()
  const dates = Object.keys(S.log).concat(Object.values(S.dayDoneOn)).sort()
  const frozen = new Set<string>()
  let cur = 0, best = 0, freezes = 0, run = 0, lastCounted = ''
  if (dates.length) {
    for (let d = dates[0]; d < t; d = addDays(d, 1)) {
      freezes = Math.min(MAX_FREEZES, freezes + (S.freezeBank[d] || 0))
      if (counted(d)) {
        cur++; run++; lastCounted = d
        if (run % 7 === 0) freezes = Math.min(MAX_FREEZES, freezes + 1)
      } else if (cur > 0 && freezes > 0) {
        freezes--; frozen.add(d); run = 0
      } else { cur = 0; run = 0 }
      best = Math.max(best, cur)
    }
  }
  freezes = Math.min(MAX_FREEZES, freezes + (S.freezeBank[t] || 0))
  const todayCounted = counted(t)
  if (todayCounted) { cur++; lastCounted = t }
  best = Math.max(best, cur)
  const daysAway = lastCounted ? daysBetween(lastCounted, t) : 0
  return { streak: cur, best, freezes, frozen, todayCounted, daysAway }
}

/** Progress-based plan: you move on when you finish a day, never because the calendar moved. */
export function settleDay() {
  markCoreIfDone() // heals a day whose words were all learned but the finish screen never ran (app closed early)
  const t = localISO()
  while (S.dayIdx < TOTAL_DAYS && S.dayDoneOn[S.dayIdx] && S.dayDoneOn[S.dayIdx] < t) S.dayIdx++
}
export function coreDone(): boolean {
  const day = dayAt(S.dayIdx)
  if (day.rv) return counted(localISO())
  return newCardsUpTo(S.dayIdx).length === 0
}
export function markCoreIfDone() {
  if (!S.dayDoneOn[S.dayIdx] && coreDone()) { S.dayDoneOn[S.dayIdx] = localISO(); save(); return true }
  return false
}
/** "Start the next day early" after finishing today's core. */
export function advanceEarly() {
  if (S.dayIdx < TOTAL_DAYS && S.dayDoneOn[S.dayIdx]) { S.dayIdx++; save() }
}

// XP + levels
export const totalXP = () => Object.values(S.log).reduce((a, l) => a + (l.xp || 0), 0)
export function level(xp = totalXP()) {
  let lv = 1, need = 200, base = 0
  while (xp >= base + need) { base += need; lv++; need = Math.round(need * 1.15) }
  return { lv, into: xp - base, need }
}

// Approximate share of everyday spoken Spanish covered by the N most frequent words
// (subtitle-corpus frequency lists such as hermitdave/FrequencyWords). Rounded on purpose.
export const COVERAGE: [number, number][] = [[100, 50], [300, 65], [500, 72], [1000, 80], [2000, 87], [3000, 90]]
export function coverage(n = known()) {
  let pct = 0, next = COVERAGE[0]
  for (const [w, p] of COVERAGE) { if (n >= w) pct = p; else { next = [w, p]; break } }
  if (n >= COVERAGE[COVERAGE.length - 1][0]) next = COVERAGE[COVERAGE.length - 1]
  return { pct, next }
}

// Dreaming Spanish level thresholds (hours of input).
export const DS_LEVELS: [number, number][] = [[1, 0], [2, 50], [3, 150], [4, 300], [5, 600], [6, 1000], [7, 1500]]
export const inputHours = () => Object.values(S.log).reduce((a, l) => a + (l.inputMin || 0), 0) / 60
export function dsLevel(h = inputHours()) {
  let lv = 1, next = DS_LEVELS[1]
  for (let i = 0; i < DS_LEVELS.length; i++) if (h >= DS_LEVELS[i][1]) { lv = DS_LEVELS[i][0]; next = DS_LEVELS[i + 1] || DS_LEVELS[i] }
  return { lv, next }
}
