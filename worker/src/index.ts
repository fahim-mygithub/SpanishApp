// spanish-nudge: one gentle daily push reminder for the Hoy app.
// Stores each device's push subscription in KV; a cron runs every 15 minutes and sends the
// reminder once the subscriber's local reminder time has passed, unless they already practised today.
import { buildPushPayload, type PushSubscription } from '@block65/webcrypto-web-push'

export interface Env {
  SUBS: KVNamespace
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
  ALLOWED_ORIGINS: string
  APP_URL: string
}
export interface Sub {
  sub: PushSubscription
  remindAt: string     // "19:30" local
  tz: string           // IANA zone
  lastDone?: string    // local date the day last counted
  lastSent?: string    // local date a reminder was last sent
  streak?: number
  day?: number         // plan day
  created: number
}

/** Local date and minutes-after-midnight for a time zone. */
export function localNow(tz: string, now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: +p.hour * 60 + +p.minute }
}
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0) }
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

/** Should this subscriber get a reminder right now? A 3-hour window means a late cron never fires at 3am. */
export function isDue(s: Sub, now = new Date()) {
  const { date, minutes } = localNow(s.tz, now)
  const at = toMin(s.remindAt)
  return minutes >= at && minutes < at + 180 && s.lastSent !== date && s.lastDone !== date
}

const GENTLE = [
  '¿Cinco minutos? Your words are ready.',
  'Five minutes of Spanish counts. Tap and you’re straight in.',
  'A quick round before bed? It only takes five minutes.',
  'Your next few words are waiting. Five minutes is plenty.',
  'Un poquito hoy. Five minutes keeps it going.',
  'Tap to start. You can stop after five minutes.',
]
/** Never guilt: streak-aware when there is one, reassuring after a break, varied otherwise. */
export function pickMessage(s: Sub, today: string): { title: string; body: string } {
  const away = s.lastDone ? daysBetween(s.lastDone, today) : 0
  if (s.lastDone && away >= 3) return { title: 'Welcome back', body: `No catching up needed. Day ${s.day || 1} is right where you left it, and five minutes is plenty.` }
  if ((s.streak || 0) >= 2 && away === 1) return { title: `${s.streak}-day streak`, body: 'Five minutes keeps it going. Tap and you’re straight in.' }
  const h = [...today].reduce((a, c) => a + c.charCodeAt(0), 0)
  return { title: 'Hoy', body: GENTLE[h % GENTLE.length] }
}

async function send(env: Env, s: Sub, msg: { title: string; body: string }) {
  const payload = await buildPushPayload(
    { data: JSON.stringify({ ...msg, tag: 'daily' }), options: { ttl: 4 * 3600, urgency: 'normal', topic: 'daily' } },
    s.sub,
    { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
  )
  return fetch(s.sub.endpoint, payload)
}

async function idFor(endpoint: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
  return [...new Uint8Array(h)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function cors(env: Env, req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  const ok = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).includes(origin)
  return ok ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' } : {}
}
const json = (data: unknown, status: number, h: Record<string, string>) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...h } })
const validTime = (v: unknown) => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v)
const validTz = (v: unknown) => { try { return typeof v === 'string' && !!new Intl.DateTimeFormat('en', { timeZone: v }) } catch { return false } }

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const h = cors(env, req)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h })
    if (req.method !== 'POST') return json({ ok: true, service: 'spanish-nudge' }, 200, h)
    if (!h['access-control-allow-origin']) return json({ error: 'origin not allowed' }, 403, h)
    const path = new URL(req.url).pathname
    let body: any
    try { body = await req.json() } catch { return json({ error: 'bad json' }, 400, h) }

    if (path === '/subscribe') {
      const sub = body.subscription as PushSubscription
      if (!sub?.endpoint?.startsWith('https://') || !sub.keys?.p256dh || !sub.keys?.auth) return json({ error: 'bad subscription' }, 400, h)
      if (!validTime(body.remindAt) || !validTz(body.tz)) return json({ error: 'bad time or zone' }, 400, h)
      const id = await idFor(sub.endpoint)
      const prev = await env.SUBS.get<Sub>(id, 'json')
      const rec: Sub = { ...(prev || {}), sub, remindAt: body.remindAt, tz: body.tz, day: body.day, created: prev?.created || Date.now() }
      await env.SUBS.put(id, JSON.stringify(rec))
      return json({ id }, 200, h)
    }
    const id = typeof body.id === 'string' ? body.id : ''
    const rec = id ? await env.SUBS.get<Sub>(id, 'json') : null
    if (!rec) return json({ error: 'unknown id' }, 404, h)

    if (path === '/settings') {
      if (validTime(body.remindAt)) rec.remindAt = body.remindAt
      if (validTz(body.tz)) rec.tz = body.tz
      rec.lastSent = undefined
      await env.SUBS.put(id, JSON.stringify(rec)); return json({ ok: true }, 200, h)
    }
    if (path === '/done') {
      if (typeof body.date === 'string') rec.lastDone = body.date
      if (typeof body.streak === 'number') rec.streak = body.streak
      if (typeof body.day === 'number') rec.day = body.day
      await env.SUBS.put(id, JSON.stringify(rec)); return json({ ok: true }, 200, h)
    }
    if (path === '/test') {
      const r = await send(env, rec, { title: 'Hoy', body: 'Reminders are on. This is what they’ll look like.' })
      return json({ ok: r.ok, status: r.status }, r.ok ? 200 : 502, h)
    }
    if (path === '/unsubscribe') { await env.SUBS.delete(id); return json({ ok: true }, 200, h) }
    return json({ error: 'not found' }, 404, h)
  },

  async scheduled(_e: ScheduledController, env: Env): Promise<void> {
    let cursor: string | undefined
    do {
      const page = await env.SUBS.list({ cursor })
      for (const k of page.keys) {
        const s = await env.SUBS.get<Sub>(k.name, 'json')
        if (!s || !isDue(s)) continue
        const today = localNow(s.tz).date
        try {
          const r = await send(env, s, pickMessage(s, today))
          if (r.status === 404 || r.status === 410) { await env.SUBS.delete(k.name); continue }
          if (r.ok) { s.lastSent = today; await env.SUBS.put(k.name, JSON.stringify(s)) }
        } catch { /* try again next run */ }
      }
      cursor = page.list_complete ? undefined : page.cursor
    } while (cursor)
  },
}
