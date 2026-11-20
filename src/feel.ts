// Immediate feedback: sound, haptics, speech, toast, confetti. Quiet by default, one moment per state change.
import { S } from './state'

let ctx: AudioContext | null = null
function tone(freq: number, at: number, dur = 0.12, type: OscillatorType = 'sine', vol = 0.12) {
  if (!S.settings.sound) return
  try {
    ctx ||= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = type; o.frequency.value = freq
    const t = ctx.currentTime + at
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02)
  } catch { /* no audio */ }
}
const buzz = (p: number | number[]) => { if (S.settings.haptics && 'vibrate' in navigator) try { navigator.vibrate(p) } catch { /* ignore */ } }

export const sfx = {
  right(combo = 0) { const b = 660 * Math.pow(2, Math.min(combo, 8) / 12); tone(b, 0); tone(b * 1.5, 0.08); buzz(12) },
  almost() { tone(520, 0, 0.14, 'triangle', 0.08) },
  wrong() { tone(220, 0, 0.18, 'triangle', 0.08); buzz([20, 40, 20]) },
  learned() { tone(784, 0); tone(988, 0.07); tone(1319, 0.14, 0.2); buzz(20) },
  done() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22)); buzz([30, 50, 60]) },
}

// Speech: the phone's own Spanish voice.
let voice: SpeechSynthesisVoice | null = null
function pick() {
  const v = speechSynthesis.getVoices()
  voice = v.find((x) => /^es[-_](MX|US|419)/i.test(x.lang)) || v.find((x) => /^es/i.test(x.lang)) || null
}
if ('speechSynthesis' in window) { pick(); speechSynthesis.onvoiceschanged = pick }
export function say(text: string, rate = 0.9) {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text.replace(/\s*\/\s*/g, ', ').replace(/[()]/g, ''))
  u.lang = voice?.lang || 'es-MX'; if (voice) u.voice = voice; u.rate = rate
  speechSynthesis.speak(u)
}

let toastT = 0
export function toast(msg: string, ms = 2600) {
  const el = document.getElementById('toast')!
  el.textContent = msg; el.classList.add('show')
  clearTimeout(toastT); toastT = window.setTimeout(() => el.classList.remove('show'), ms)
}

export function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const box = document.createElement('div'); box.className = 'burst'
  const cols = ['#f4b740', '#7cc4f2', '#5dcf98', '#e8ecf4']
  for (let i = 0; i < 46; i++) {
    const p = document.createElement('i')
    p.style.left = '50%'; p.style.top = '38%'; p.style.background = cols[i % cols.length]
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 520}px`)
    p.style.setProperty('--dy', `${Math.random() * 520 - 120}px`)
    p.style.setProperty('--r', `${Math.random() * 720 - 360}deg`)
    p.style.animationDelay = `${Math.random() * 90}ms`
    box.appendChild(p)
  }
  document.body.appendChild(box); setTimeout(() => box.remove(), 1400)
}
