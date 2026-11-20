// The Start session: one tap in, reviews first, then today's new words, then optional practice.
// Five active minutes (or finishing the day's words) makes the day count. Exit any time, nothing is lost.
import { dayAt, TOTAL_DAYS, type Card } from '../data'
import { localISO } from '../dates'
import { advanceEarly, markCoreIfDone, MIN_SECONDS, streak, counted } from '../habit'
import { S, save, today } from '../state'
import { allCards, dueCards, graduate, newCardsUpTo, preview, review } from '../srs'
import { confetti, say, sfx, toast } from '../feel'
import { $, $$, app, checkTyped, esc, icon, missedAccent, shuffle } from '../ui'
import { notifyDone } from '../push'

type Step =
  | { kind: 'review'; c: Card; flip: boolean; misses: number }
  | { kind: 'intro'; c: Card }
  | { kind: 'drill'; c: Card; stage: number }
  | { kind: 'practice'; c: Card; q: 'mc-en' | 'mc-es' | 'listen' }

interface Item { c: Card; stage: number; slips: number }
interface Session {
  queue: Step[]; total: number; doneSteps: number
  group: Item[]; groups: Card[][]; gi: number
  combo: number; best: number; xp: number; learned: string[]; reviewed: number
  answered: boolean; opts?: { v: string; ok: boolean }[]
  started: number; lastTick: number; countedAtStart: boolean; announced: boolean
  mode: 'daily' | 'practice' | 'quiz'
  quizWeek?: number; correct: number; asked: number
  onExit: () => void
}
let X: Session | null = null
let tickT = 0

export function startSession(onExit: () => void, mode: 'daily' | 'practice' | 'quiz' = 'daily', quizWeek?: number) {
  const reviews = mode === 'daily' ? dueCards().slice(0, S.settings.reviewCap) : []
  const fresh = mode === 'daily' ? newCardsUpTo(S.dayIdx).slice(0, 10) : []
  const groups: Card[][] = []
  for (let i = 0; i < fresh.length; i += 5) groups.push(fresh.slice(i, i + 5))
  X = {
    queue: reviews.map((c) => ({ kind: 'review', c, flip: false, misses: 0 })), total: 0, doneSteps: 0,
    group: [], groups, gi: -1, combo: 0, best: 0, xp: 0, learned: [], reviewed: 0, answered: false,
    started: Date.now(), lastTick: Date.now(), countedAtStart: counted(localISO()), announced: false, mode, onExit,
    quizWeek, correct: 0, asked: 0,
  }
  X.total = reviews.length + fresh.length * 5
  if (mode === 'quiz') addPractice(20, quizWeek)
  else if (!X.queue.length && !groups.length) addPractice(10)
  document.body.classList.add('focus')
  clearInterval(tickT); tickT = window.setInterval(tick, 1000)
  render()
}

// Extra practice never touches the review schedule (Mnemosyne-style cramming), so doing more is never penalised.
function addPractice(n: number, week?: number) {
  if (!X) return
  let pool = shuffle(allCards().filter((c) => S.srs[c.id] && (week === undefined || c.w === week)))
  if (week !== undefined && pool.length < n) pool = pool.concat(shuffle(allCards().filter((c) => S.srs[c.id] && c.w < week)))
  pool.slice(0, n).forEach((c, i) => X!.queue.push({ kind: 'practice', c, q: (['mc-en', 'listen', 'mc-es'] as const)[i % 3] }))
  X.total += Math.min(n, pool.length)
}

// Active time only: paused while the app is in the background.
function tick() {
  if (!X || document.visibilityState !== 'visible') { if (X) X.lastTick = Date.now(); return }
  const now = Date.now(); const d = Math.min(5, Math.round((now - X.lastTick) / 1000)); X.lastTick = now
  const t = today(); t.sec += d
  if (t.sec % 5 === 0) save()
  updateRing()
  if (!X.countedAtStart && !X.announced && t.sec >= MIN_SECONDS) {
    X.announced = true; save(); sfx.done(); toast('Today counts. Keep going or stop any time.'); notifyDone(streak().streak)
  }
}
function updateRing() {
  const r = $('#ring'); if (!r) return
  const sec = today().sec; const p = Math.min(1, sec / MIN_SECONDS)
  const c = r.querySelector('circle.fg') as SVGCircleElement
  c.style.strokeDashoffset = String(113 * (1 - p))
  c.style.stroke = p >= 1 ? 'var(--accent-2)' : 'var(--accent)'
  const lbl = r.querySelector('.lbl')!; lbl.innerHTML = p >= 1 ? icon('check') : `${Math.max(0, Math.ceil((MIN_SECONDS - sec) / 60))}m`
}

function nextStep(): Step | null {
  if (!X) return null
  if (X.queue.length) return X.queue[0]
  // learning: drills for the current group, then the next group's intros
  const open = X.group.filter((it) => it.stage <= 4)
  if (open.length) {
    const last = (X as any).lastId as string | undefined
    const pool = open.length > 1 ? open.filter((it) => it.c.id !== last) : open
    pool.sort((a, b) => a.stage - b.stage || Math.random() - 0.5)
    const it = pool[Math.floor(Math.random() * Math.min(2, pool.length))]
    return { kind: 'drill', c: it.c, stage: it.stage }
  }
  if (X.gi + 1 < X.groups.length) {
    X.gi++; X.group = X.groups[X.gi].map((c) => ({ c, stage: 1, slips: 0 }))
    X.queue.push(...X.groups[X.gi].map((c) => ({ kind: 'intro' as const, c })))
    return X.queue[0]
  }
  return null
}

function bar(): string {
  const p = X!.total ? Math.min(100, Math.round((X!.doneSteps / X!.total) * 100)) : 0
  return `<div class="topbar">
    <button class="icon-btn" id="quit" aria-label="Stop here">${icon('x')}</button>
    <div class="bar"><span style="width:${p}%"></span></div>
    <span class="combo num" id="combo" aria-label="Combo">${X!.combo >= 2 ? `×${X!.combo}` : ''}</span>
    <div class="ring" id="ring" title="5-minute minimum"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" fill="none" stroke="var(--surface-raised)" stroke-width="4"/><circle class="fg" cx="22" cy="22" r="18" fill="none" stroke-width="4" stroke-linecap="round" stroke-dasharray="113" stroke-dashoffset="113"/></svg><span class="lbl num"></span></div>
  </div>`
}

function render() {
  if (!X) return
  const step = nextStep()
  if (!step) return finish()
  X.answered = false
  const root = app()
  if (step.kind === 'review') root.innerHTML = bar() + reviewHTML(step)
  else if (step.kind === 'intro') root.innerHTML = bar() + introHTML(step.c)
  else root.innerHTML = bar() + questionHTML(step)
  updateRing()
  $('#quit').onclick = () => finish(true)
  wire(step)
  window.scrollTo(0, 0)
}

const speakBtn = (big = false) => `<button class="speak${big ? ' big' : ''}" id="spk" aria-label="Play audio">${icon('speak')}</button>`

function reviewHTML(s: Extract<Step, { kind: 'review' }>) {
  const pv = s.flip ? preview(s.c.id) : null
  return `<div class="card" style="text-align:center;padding:28px 20px">
    <div class="prompt-kind" style="justify-content:center">Review · do you remember it?</div>
    <div class="word">${esc(s.c.es)}</div>
    ${s.flip ? `<div class="meaning pop-in">${esc(s.c.en)}</div>` : `<div class="muted small">Say the meaning in your head first</div>`}
    <div style="margin-top:18px">${speakBtn()}</div>
  </div>
  <div class="dock">${s.flip
    ? `<div class="pair"><button class="btn" id="forgot">Forgot<span class="muted small">&nbsp;${pv!.forgot}</span></button><button class="btn primary" id="got">Got it<span class="small" style="opacity:.7">&nbsp;${pv!.good}</span></button></div>`
    : `<button class="btn primary" id="show">Show meaning</button>`}</div>`
}

function introHTML(c: Card) {
  const n = X!.group.findIndex((it) => it.c.id === c.id) + 1 + X!.gi * 5
  const total = X!.groups.reduce((a, g) => a + g.length, 0)
  return `<div class="card pop-in" style="text-align:center;padding:28px 20px">
    <div class="prompt-kind" style="justify-content:center">New word ${n} of ${total}</div>
    <div class="word">${esc(c.es)}</div>
    <div class="meaning" style="color:var(--ink)">${esc(c.en)}</div>
    <div style="margin-top:18px">${speakBtn()}</div>
  </div>
  <p class="muted small" style="text-align:center;margin:16px 8px">Say it out loud twice after the audio.</p>
  <div class="dock"><div class="pair"><button class="btn" id="know">I know this</button><button class="btn primary" id="gotit">Got it</button></div></div>`
}

function distractors(c: Card, field: 'en' | 'es') {
  const all = allCards().filter((x) => x.id !== c.id && x.en !== c.en && x.es !== c.es)
  const near = shuffle(all.filter((x) => Math.abs(x.day - c.day) <= 14))
  return shuffle([...(near.length >= 3 ? near : shuffle(all)).slice(0, 3), c]).map((x) => ({ v: x[field], ok: x.id === c.id }))
}
const STAGES: Record<number, [string, string]> = { 1: ['Recognise', 'What does this mean?'], 2: ['Listen', 'Which word did you hear?'], 3: ['Recall', 'How do you say this in Spanish?'], 4: ['Produce', 'Type it in Spanish'] }

function questionHTML(s: Extract<Step, { kind: 'drill' | 'practice' }>) {
  let stage = s.kind === 'drill' ? s.stage : s.q === 'mc-en' ? 1 : s.q === 'listen' ? 2 : 3
  if (stage === 4 && s.c.es.split(/\s+/).length > 4) stage = 3
  const it = X!.group.find((x) => x.c.id === s.c.id)
  const dots = s.kind === 'drill' && it ? `<span class="stage">${[1, 2, 3, 4].map((n) => `<i class="${n < it.stage ? 'on' : ''}"></i>`).join('')}</span>` : `<span>${s.kind === 'practice' ? 'Extra practice' : ''}</span>`
  X!.opts = stage === 4 ? undefined : distractors(s.c, stage === 1 ? 'en' : 'es')
  ;(X as any).stage = stage
  let h = `<div class="card"><div class="prompt-kind"><span>${STAGES[stage][0]} · ${STAGES[stage][1]}</span>${dots}</div>`
  if (stage === 1) h += `<div class="word">${esc(s.c.es)}</div>${speakBtn()}`
  if (stage === 2) h += `<div style="text-align:center;margin:20px 0 4px">${speakBtn(true)}</div>`
  if (stage >= 3) h += `<div class="word" style="font-size:clamp(1.6rem,7vw,2.2rem)">${esc(s.c.en)}</div>`
  if (stage === 4) {
    const first = s.c.es.replace(/^[¿¡]/, '').split(/\s*\/\s*/)[0].replace(/\s*\(.*?\)/g, '')
    h += `<p class="muted small" style="margin:0 0 12px">Starts with “${esc(first[0])}”, ${first.length} letters. Accents optional.</p>
      <input class="field" id="typed" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-label="Your answer">`
  } else h += `<div class="opts">${X!.opts!.map((o, k) => `<button class="opt" data-k="${k}">${esc(o.v)}</button>`).join('')}</div>`
  h += `<div class="feedback" id="fb" aria-live="polite"></div></div>
    <div class="dock">${stage === 4 ? `<div class="pair"><button class="btn" id="idk">Show me</button><button class="btn primary" id="check">Check</button></div>` : ''}<button class="btn primary" id="next" style="display:none">Continue</button></div>`
  return h
}

function wire(step: Step) {
  if (import.meta.env.MODE === 'test') (window as any).__hoyStep = step
  const spk = document.getElementById('spk'); if (spk) spk.onclick = () => say(step.c.es)
  if (step.kind === 'review') {
    if (!step.flip) say(step.c.es)
    const show = document.getElementById('show'); if (show) show.onclick = () => { step.flip = true; render() }
    const got = document.getElementById('got'), forgot = document.getElementById('forgot')
    if (got) got.onclick = () => { review(step.c.id, step.misses ? 'hard' : 'good'); X!.reviewed++; today().reviewed++; gain(5); right(); X!.queue.shift(); X!.doneSteps++; save(); render() }
    if (forgot) forgot.onclick = () => {
      review(step.c.id, 'forgot'); step.misses++; step.flip = false; X!.combo = 0; sfx.wrong()
      X!.queue.shift(); X!.queue.splice(Math.min(3, X!.queue.length), 0, step); X!.total++; X!.doneSteps++; save(); render()
    }
    return
  }
  if (step.kind === 'intro') {
    say(step.c.es)
    $('#gotit').onclick = () => { X!.queue.shift(); render() }
    $('#know').onclick = () => {
      const it = X!.group.find((x) => x.c.id === step.c.id)!; it.stage = 5
      graduate(step.c.id, 0, true); X!.learned.push(step.c.id); today().learned++; X!.doneSteps += 4; gain(10); save()
      X!.queue.shift(); render()
    }
    return
  }
  const stage = (X as any).stage as number
  if (stage <= 2) say(step.c.es)
  const fb = $('#fb'), next = $('#next')
  const finishQ = (res: 'right' | 'almost' | 'wrong', msg: string) => {
    if (X!.answered) return; X!.answered = true
    fb.className = `feedback ${res === 'wrong' ? 'no' : 'ok'}`; fb.innerHTML = msg
    if (step.kind === 'drill') {
      const it = X!.group.find((x) => x.c.id === step.c.id)!
      if (res !== 'wrong') {
        it.stage++; X!.doneSteps++
        if (it.stage > 4) { graduate(it.c.id, it.slips); X!.learned.push(it.c.id); today().learned++; gain(20); setTimeout(() => sfx.learned(), 160) }
      } else { it.slips++; if (it.stage > 1) { it.stage--; X!.doneSteps-- } }
      ;(X as any).lastId = it.c.id
    } else { X!.queue.shift(); X!.doneSteps++; X!.asked++; if (res !== 'wrong') X!.correct++ }
    if (res === 'right') { gain(10); right() } else if (res === 'almost') { gain(6); sfx.almost(); X!.combo = 0; bumpCombo() } else { X!.combo = 0; bumpCombo(); sfx.wrong() }
    if (stage >= 3 || res === 'wrong') say(step.c.es)
    save()
    const dock = $('.dock'); $$('.btn', dock).forEach((b) => { if (b.id !== 'next') b.remove() }); const pair = dock.querySelector('.pair'); if (pair) pair.remove()
    next.style.display = 'inline-flex'; next.focus()
  }
  next.onclick = () => render()
  if (stage === 4) {
    const inp = $<HTMLInputElement>('#typed'); inp.focus()
    const go = () => {
      const v = inp.value; if (!v.trim()) return
      const res = checkTyped(v, step.c.es)
      finishQ(res, res === 'right' ? (missedAccent(v, step.c.es) ? `Correct. With accents: <b>${esc(step.c.es)}</b>` : 'Correct.') : res === 'almost' ? `Almost. It's <b>${esc(step.c.es)}</b>` : `It's <b>${esc(step.c.es)}</b>. It'll come round again.`)
    }
    $('#check').onclick = go
    inp.onkeydown = (e) => { if (e.key === 'Enter') { if (X!.answered) next.click(); else go() } }
    $('#idk').onclick = () => finishQ('wrong', `It's <b>${esc(step.c.es)}</b>. It'll come round again.`)
  } else {
    $$('.opt').forEach((b) => (b.onclick = () => {
      if (X!.answered) return
      const k = +b.dataset.k!; const ok = X!.opts![k].ok
      b.classList.add(ok ? 'right' : 'wrong'); $$('.opt')[X!.opts!.findIndex((o) => o.ok)].classList.add('right')
      finishQ(ok ? 'right' : 'wrong', ok ? 'Correct.' : `<b>${esc(step.c.es)}</b> means ${esc(step.c.en)}.`)
    }))
  }
}

function gain(n: number) { const bonus = Math.min(X!.combo, 5) * 2; X!.xp += n + bonus; today().xp += n + bonus }
function right() { X!.combo++; X!.best = Math.max(X!.best, X!.combo); sfx.right(X!.combo); bumpCombo() }
function bumpCombo() {
  const el = document.getElementById('combo'); if (!el) return
  el.textContent = X!.combo >= 2 ? `×${X!.combo}` : ''
  if (X!.combo >= 2) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop') }
}

function finish(early = false) {
  if (!X) return
  clearInterval(tickT)
  const s = X; X = null
  const t = today(); const date = localISO()
  const coreFinished = s.mode === 'daily' && markCoreIfDone()
  const isCounted = counted(date)
  if (isCounted && !s.countedAtStart) notifyDone(streak().streak)
  // Variable reward: once a day, sometimes, after the day counts.
  let reward = ''
  if (isCounted && !t.bonus) {
    const st = streak(); const roll = Math.random()
    if (roll < 0.25 && st.freezes < 2) { S.freezeBank[date] = (S.freezeBank[date] || 0) + 1; reward = 'freeze' }
    else if (roll < 0.5) { t.xp += 50; s.xp += 50; reward = 'xp' }
    t.bonus = reward || 'none'
  }
  save()
  const st = streak()
  const day = dayAt(S.dayIdx)
  if (isCounted) { sfx.done(); if (!s.countedAtStart || coreFinished) confetti() }
  if (s.mode === 'quiz' && s.quizWeek !== undefined && s.asked) {
    S.quiz[s.quizWeek] = { s: s.correct, n: s.asked, ts: Date.now() }; save()
  }
  const left = Math.max(0, Math.ceil((300 - t.sec) / 60))
  document.body.classList.add('focus')
  app().innerHTML = `
    <p class="context">Day ${S.dayIdx} · ${early ? 'stopped' : 'session done'}</p>
    <h1 class="display">${s.mode === 'quiz' && s.asked ? `Week ${s.quizWeek}: ${s.correct}/${s.asked}` : isCounted ? 'Today counts' : 'Good start'}</h1>
    <p class="lede">${isCounted ? (coreFinished ? `Day ${S.dayIdx}'s words are done.` : 'That keeps your streak going.') : `${left} more minute${left === 1 ? '' : 's'} of practice or ${10 - Math.min(9, t.inputMin)} of listening makes today count. Everything you did is saved.`}</p>
    <div class="hero-num num pop-in">+${s.xp}<span class="muted" style="font-size:1.4rem;font-weight:600"> XP</span></div>
    <div class="tiles">
      <div class="tile"><div class="big num" style="color:var(--accent)">${icon('flame')}${st.streak}</div><div class="lbl">day streak${st.freezes ? ` · ${st.freezes} freeze${st.freezes > 1 ? 's' : ''}` : ''}</div></div>
      <div class="tile"><div class="big num">${s.learned.length}<span class="muted" style="font-size:1rem">+${s.reviewed}</span></div><div class="lbl">learned + reviewed</div></div>
    </div>
    ${reward === 'freeze' ? `<div class="card chest pop-in">${icon('snow')}<div><b>Bonus: streak freeze</b><div class="muted small">Covers a missed day automatically. You hold ${st.freezes}.</div></div></div>` : ''}
    ${reward === 'xp' ? `<div class="card chest pop-in">${icon('gift')}<div><b>Bonus: +50 XP</b><div class="muted small">Lucky day.</div></div></div>` : ''}
    ${s.best >= 5 ? `<p class="muted small" style="margin-top:16px">Best combo: ×${s.best}</p>` : ''}
    <div class="dock"><div style="display:grid;gap:10px">
      ${S.dayDoneOn[S.dayIdx] && !day.rv && S.dayIdx < TOTAL_DAYS && newCardsUpTo(S.dayIdx + 1).length ? `<button class="btn" id="ahead">Learn Day ${S.dayIdx + 1}'s words now</button>` : ''}
      <button class="btn" id="more">Keep going · extra practice</button>
      <button class="btn primary" id="done">Done</button>
    </div></div>`
  $('#done').onclick = () => { document.body.classList.remove('focus'); s.onExit() }
  $('#more').onclick = () => startSession(s.onExit, dueCards().length || newCardsUpTo(S.dayIdx).length ? 'daily' : 'practice')
  const ahead = document.getElementById('ahead'); if (ahead) ahead.onclick = () => { advanceEarly(); startSession(s.onExit) }
}

export const inSession = () => !!X
