// Spaced repetition on FSRS (ts-fsrs, MIT) instead of SM-2. Borrowed from the
// open-spaced-repetition project: better retention for the same number of reviews.
import { createEmptyCard, fsrs, Rating, type Card as FCard, type Grade } from 'ts-fsrs'
import { CORE, type Card } from './data'
import { S, type SrsCard } from './state'

// Graduation from Learn mode goes straight to "review" (first review tomorrow), so no learning steps.
// A forgotten review comes back 10 minutes later, i.e. later in the same session.
const F = fsrs({ request_retention: 0.88, enable_fuzz: true, learning_steps: [], relearning_steps: ['10m'], maximum_interval: 365 })

const toF = (c: SrsCard): FCard => ({
  due: new Date(c.due), stability: c.s, difficulty: c.d, elapsed_days: 0, scheduled_days: c.sd,
  learning_steps: c.ls, reps: c.reps, lapses: c.lapses, state: c.st, last_review: c.lr ? new Date(c.lr) : undefined,
})
const fromF = (c: FCard): SrsCard => ({
  due: c.due.toISOString(), s: c.stability, d: c.difficulty, sd: c.scheduled_days, ls: c.learning_steps,
  reps: c.reps, lapses: c.lapses, st: c.state, lr: c.last_review?.toISOString(), t: Date.now(),
})

export const allCards = (): Card[] => CORE.concat(S.mined)
export const known = (): number => Object.keys(S.srs).length
export const isLearned = (id: string) => !!S.srs[id]

/** Cards due by the end of today, most overdue first. */
export function dueCards(): Card[] {
  const end = new Date(); end.setHours(23, 59, 59, 999)
  const map = new Map(allCards().map((c) => [c.id, c]))
  return Object.entries(S.srs)
    .filter(([, s]) => new Date(s.due) <= end)
    .sort((a, b) => a[1].due.localeCompare(b[1].due))
    .map(([id]) => map.get(id)).filter((c): c is Card => !!c)
}
/** New words for a plan day (and any earlier ones you skipped). Your own mined cards first. */
export function newCardsUpTo(dayIdx: number): Card[] {
  return allCards().filter((c) => c.day <= dayIdx && !S.srs[c.id]).sort((a, b) => (b.t ? 1 : 0) - (a.t ? 1 : 0) || a.day - b.day)
}

export type Answer = 'forgot' | 'hard' | 'good' | 'easy'
const RATE: Record<Answer, Grade> = { forgot: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy }

export function review(id: string, a: Answer) {
  const cur = S.srs[id] ? toF(S.srs[id]) : createEmptyCard(new Date())
  S.srs[id] = fromF(F.next(cur, new Date(), RATE[a]).card)
}

/** Predicted wait for each answer, e.g. "10m", "3d" — shown on the buttons so a rating feels like progress. */
export function preview(id: string): Record<Answer, string> {
  const cur = S.srs[id] ? toF(S.srs[id]) : createEmptyCard(new Date())
  const now = Date.now()
  const out = {} as Record<Answer, string>
  const rec = F.repeat(cur, new Date())
  for (const a of Object.keys(RATE) as Answer[]) out[a] = fmtWait(rec[RATE[a]].card.due.getTime() - now)
  return out
}
function fmtWait(ms: number) {
  const m = Math.round(ms / 60000)
  if (m < 60) return `${Math.max(1, m)}m`
  const d = Math.round(m / 1440)
  if (d < 1) return `${Math.round(m / 60)}h`
  if (d < 31) return `${d}d`
  return `${Math.round(d / 30)}mo`
}

/** First time a word is learned: rated by how the drills went. */
export function graduate(id: string, slips: number, alreadyKnew = false) {
  review(id, alreadyKnew ? 'easy' : slips >= 2 ? 'hard' : 'good')
  // A brand-new word always gets its first check tomorrow: early reinforcement beats a longer first gap.
  if (!alreadyKnew) { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); S.srs[id].due = d.toISOString() }
}
