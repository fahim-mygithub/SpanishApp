import {
  createElement, Bell, BookOpen, Check, ChevronRight, Flame, Gift, Headphones, Layers, Pause, Play, Plus,
  RotateCcw, Settings, Share, Snowflake, Sparkles, Sun, TrendingUp, Trophy, Volume2, X, Zap, type IconNode,
} from 'lucide'

const ICONS: Record<string, IconNode> = {
  bell: Bell, book: BookOpen, check: Check, chev: ChevronRight, flame: Flame, gift: Gift, headphones: Headphones,
  layers: Layers, pause: Pause, play: Play, plus: Plus, redo: RotateCcw, settings: Settings, share: Share,
  snow: Snowflake, sparkles: Sparkles, sun: Sun, trend: TrendingUp, trophy: Trophy, speak: Volume2, x: X, zap: Zap,
}
const cache: Record<string, string> = {}
export function icon(name: keyof typeof ICONS | string): string {
  if (!cache[name]) { const el = createElement(ICONS[name]); el.setAttribute('aria-hidden', 'true'); cache[name] = el.outerHTML }
  return cache[name]
}

export const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T
export const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll(sel)] as T[]
export const app = () => document.getElementById('app')!

export function shuffle<T>(a: T[]): T[] { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

/** Bottom sheet for anything that isn't the next decision (progressive disclosure). */
export function sheet(html: string, onMount?: (el: HTMLElement, close: () => void) => void) {
  const bg = document.createElement('div'); bg.className = 'sheet-bg'
  const el = document.createElement('div'); el.className = 'sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true')
  el.innerHTML = `<div class="grab"></div>${html}`
  const close = () => { bg.remove(); el.remove(); document.removeEventListener('keydown', onKey) }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
  bg.onclick = close; document.addEventListener('keydown', onKey)
  document.body.append(bg, el)
  onMount?.(el, close)
  return close
}

/** Text normalisation for typed answers: accents and punctuation optional. */
export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,]/g, '').replace(/\s+/g, ' ').trim()
export function answersFor(es: string): string[] {
  const out = new Set<string>()
  for (const p of es.split(/\s*\/\s*/)) {
    out.add(p)
    const noPar = p.replace(/\s*\(.*?\)\s*/g, ' ').trim(); if (noPar) out.add(noPar)
  }
  return [...out].map(norm).filter(Boolean)
}
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}
/** right / almost (one typo or only accents missing, borrowed from Conjugar's partial credit) / wrong */
export function checkTyped(input: string, es: string): 'right' | 'almost' | 'wrong' {
  const v = norm(input); const answers = answersFor(es)
  if (answers.includes(v)) return 'right'
  if (answers.some((a) => a.length >= 4 && editDistance(a, v) === 1)) return 'almost'
  return 'wrong'
}
export const missedAccent = (input: string, es: string) => {
  const raw = input.toLowerCase().trim()
  return es.split(/\s*\/\s*/).some((p) => { const q = p.replace(/\s*\(.*?\)/g, '').trim().toLowerCase(); return q !== raw && norm(q) === norm(raw) })
}
