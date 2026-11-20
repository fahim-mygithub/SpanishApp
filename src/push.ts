// Daily reminder via Web Push. Works on iPhone (iOS 16.4+) and Android once the app is on the
// home screen. A tiny Cloudflare Worker (../worker) holds the subscription and sends the nudge
// at your reminder time, and skips it if you've already practised that day.
import { localISO } from './dates'
import { S } from './state'

const URL_ = (import.meta.env.VITE_PUSH_URL as string | undefined)?.replace(/\/$/, '')
const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
const ID_KEY = 'hoy-push-id'

export const pushConfigured = () => !!(URL_ && VAPID)
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
export const pushId = () => { try { return localStorage.getItem(ID_KEY) } catch { return null } }

function b64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}
async function post(path: string, body: unknown) {
  const r = await fetch(`${URL_}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${path} ${r.status}`)
  return r.json().catch(() => ({}))
}

/** Must be called from a tap (iOS only allows the permission prompt from a user gesture). */
export async function enableReminders(): Promise<string> {
  if (!pushConfigured()) throw new Error('The reminder server isn’t set up yet. See the README.')
  if (!pushSupported()) throw new Error(isIOS() && !isStandalone() ? 'Add the app to your Home Screen first, then turn reminders on from there.' : 'This browser can’t receive push notifications.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notifications are blocked. Allow them in your phone settings for this app.')
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID!) }))
  const res = await post('/subscribe', { subscription: sub.toJSON(), remindAt: S.settings.remindAt, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, day: S.dayIdx })
  try { localStorage.setItem(ID_KEY, res.id) } catch { /* ignore */ }
  return res.id
}
export async function disableReminders() {
  const id = pushId(); if (!id) return
  try { await post('/unsubscribe', { id }) } catch { /* ignore */ }
  try { const reg = await navigator.serviceWorker.ready; await (await reg.pushManager.getSubscription())?.unsubscribe() } catch { /* ignore */ }
  try { localStorage.removeItem(ID_KEY) } catch { /* ignore */ }
}
export async function updateReminderTime() {
  const id = pushId(); if (!id || !pushConfigured()) return
  await post('/settings', { id, remindAt: S.settings.remindAt, tz: Intl.DateTimeFormat().resolvedOptions().timeZone })
}
export async function testReminder() { const id = pushId(); if (!id) throw new Error('Reminders are off.'); await post('/test', { id }) }

/** Tell the server today counts, so tonight's reminder is skipped. Fire and forget. */
export function notifyDone(streakNow?: number) {
  const id = pushId(); if (!id || !pushConfigured()) return
  post('/done', { id, date: localISO(), day: S.dayIdx, streak: streakNow }).catch(() => {})
}
