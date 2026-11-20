import type { Card } from './data'
import { localISO } from './dates'

/** One FSRS card, stored compactly. `t` is the last-change timestamp used for sync merges. */
export interface SrsCard {
  due: string; s: number; d: number; sd: number; ls: number
  reps: number; lapses: number; st: number; lr?: string; t: number
}
/** What happened on one calendar day. */
export interface DayLog {
  sec: number        // active practice seconds
  xp: number
  learned: number
  reviewed: number
  inputMin: number   // listening/watching minutes logged
  bonus?: string     // variable reward already claimed today
}
export interface Settings {
  remindAt: string   // "19:30"
  sound: boolean
  haptics: boolean
  reviewCap: number  // max reviews in one Start session (backlog never piles onto you)
}
export interface State {
  v: 2
  dayIdx: number                        // plan day you're on (progress-based, not calendar)
  dayDoneOn: Record<string, string>     // plan day -> calendar date its core was finished
  done: Record<string, number>          // "planDay-taskKey" -> +ts ticked / -ts unticked
  srs: Record<string, SrsCard>
  mined: Card[]
  log: Record<string, DayLog>           // calendar date -> activity
  freezeBank: Record<string, number>    // calendar date -> freezes won that day (variable reward)
  quiz: Record<string, { s: number; n: number; ts: number }>
  settings: Settings
  settingsAt: number
}

export const DEFAULTS: Settings = { remindAt: '19:30', sound: true, haptics: true, reviewCap: 25 }
const KEY = 'hoy-state-v2'

export function fresh(): State {
  return { v: 2, dayIdx: 1, dayDoneOn: {}, done: {}, srs: {}, mined: [], log: {}, freezeBank: {}, quiz: {}, settings: { ...DEFAULTS }, settingsAt: 0 }
}

export let S: State = load()

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const v = JSON.parse(raw)
      if (v && v.v === 2) return { ...fresh(), ...v, settings: { ...DEFAULTS, ...(v.settings || {}) } }
    }
  } catch { /* storage unavailable */ }
  return fresh()
}

const listeners = new Set<() => void>()
export function onSave(fn: () => void) { listeners.add(fn) }

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)) } catch { /* ignore */ }
  listeners.forEach((fn) => fn())
}
export function replace(next: State) { S = next; try { localStorage.setItem(KEY, JSON.stringify(S)) } catch { /* ignore */ } }

export function today(): DayLog {
  const k = localISO()
  return (S.log[k] ||= { sec: 0, xp: 0, learned: 0, reviewed: 0, inputMin: 0 })
}

export const isDone = (day: number, k: string) => (S.done[`${day}-${k}`] || 0) > 0
export function setDone(day: number, k: string, on: boolean) { S.done[`${day}-${k}`] = on ? Date.now() : -Date.now(); save() }

/** Merge two copies of state (phone + laptop). Every field merges per item, newest wins. */
export function merge(a: State, b: State | null): State {
  if (!b) return a
  const o = fresh()
  o.dayIdx = Math.max(a.dayIdx, b.dayIdx)
  o.dayDoneOn = { ...b.dayDoneOn, ...a.dayDoneOn }
  for (const [k, v] of Object.entries(b.dayDoneOn || {})) if (a.dayDoneOn[k] && v < a.dayDoneOn[k]) o.dayDoneOn[k] = v
  o.done = { ...(b.done || {}) }
  for (const [k, v] of Object.entries(a.done)) { const w = o.done[k]; if (w === undefined || Math.abs(v) >= Math.abs(w)) o.done[k] = v }
  o.srs = { ...(b.srs || {}) }
  for (const [k, v] of Object.entries(a.srs)) { const w = o.srs[k]; if (!w || v.t >= w.t) o.srs[k] = v }
  const m = new Map<string, Card>(); for (const c of [...(b.mined || []), ...a.mined]) m.set(c.id, c); o.mined = [...m.values()]
  o.log = { ...(b.log || {}) }
  for (const [k, v] of Object.entries(a.log)) {
    const w = o.log[k]
    o.log[k] = !w ? v : { sec: Math.max(v.sec, w.sec), xp: Math.max(v.xp, w.xp), learned: Math.max(v.learned, w.learned), reviewed: Math.max(v.reviewed, w.reviewed), inputMin: Math.max(v.inputMin, w.inputMin), bonus: v.bonus || w.bonus }
  }
  o.freezeBank = { ...(b.freezeBank || {}), ...a.freezeBank }
  o.quiz = { ...(b.quiz || {}) }
  for (const [k, v] of Object.entries(a.quiz)) { const w = o.quiz[k]; if (!w || v.ts >= w.ts) o.quiz[k] = v }
  const newer = (b.settingsAt || 0) > a.settingsAt ? b : a
  o.settings = { ...DEFAULTS, ...newer.settings }; o.settingsAt = newer.settingsAt
  return o
}
