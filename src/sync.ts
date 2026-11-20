// Optional: save progress to a JSON file in a private GitHub repo so phone and laptop share it.
// The token stays in this browser's local storage and is never written to the repo.
import { merge, onSave, replace, S, type State } from './state'

export interface GhCfg { owner: string; repo: string; path: string; token: string }
const CFG_KEY = 'hoy-gh'
export let gh: GhCfg = (() => { try { return JSON.parse(localStorage.getItem(CFG_KEY) || 'null') || { owner: '', repo: 'spanish-data', path: 'hoy-state.json', token: '' } } catch { return { owner: '', repo: 'spanish-data', path: 'hoy-state.json', token: '' } } })()
export function setGh(c: GhCfg) { gh = c; try { localStorage.setItem(CFG_KEY, JSON.stringify(c)) } catch { /* ignore */ } }
export const ghOn = () => !!(gh.token && gh.owner && gh.repo)
export let syncMsg = 'Saved on this device'

let sha: string | null = null, running: Promise<void> | null = null, timer = 0, pending = false
const b64e = (s: string) => { const b = new TextEncoder().encode(s); let o = ''; for (let i = 0; i < b.length; i += 0x8000) o += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(o) }
const b64d = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), (c) => c.charCodeAt(0)))
const url = () => `https://api.github.com/repos/${encodeURIComponent(gh.owner)}/${encodeURIComponent(gh.repo)}/contents/${gh.path.split('/').map(encodeURIComponent).join('/')}`
const call = (method: string, body?: unknown) => fetch(url(), { method, cache: 'no-store', headers: { Authorization: `Bearer ${gh.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, body: body ? JSON.stringify(body) : undefined })

async function pull(): Promise<State | null> {
  const r = await call('GET')
  if (r.status === 404) { sha = null; return null }
  if (!r.ok) throw new Error(r.status === 401 ? 'token rejected' : r.status === 403 ? 'token lacks access to this repo' : `GitHub ${r.status}`)
  const j = await r.json(); sha = j.sha
  const v = JSON.parse(b64d(j.content)); return v && v.v === 2 ? v : null
}

export function sync(): Promise<void> {
  if (!ghOn()) { syncMsg = 'Saved on this device'; return Promise.resolve() }
  if (running) { pending = true; return running }
  running = (async () => {
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const remote = await pull()
        const merged = merge(S, remote); replace(merged)
        const body = JSON.stringify(merged)
        if (remote && JSON.stringify(remote) === body) { syncMsg = 'Synced with GitHub'; return }
        const r = await call('PUT', { message: `Progress ${new Date().toISOString()}`, content: b64e(body), ...(sha ? { sha } : {}) })
        if (r.status === 409 || r.status === 422) continue
        if (!r.ok) throw new Error(r.status === 404 ? 'repo not found' : r.status === 403 ? 'token needs Contents: read and write' : `GitHub ${r.status}`)
        sha = (await r.json()).content.sha
        syncMsg = `Synced · ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
        return
      }
      syncMsg = 'Sync conflict, will retry'
    } catch (e) { syncMsg = `Saved on this device · sync failed: ${(e as Error).message}` }
    finally { running = null; if (pending) { pending = false; schedule() } }
  })()
  return running
}
function schedule() { if (!ghOn()) return; clearTimeout(timer); timer = window.setTimeout(() => void sync(), 3000) }
onSave(schedule)
