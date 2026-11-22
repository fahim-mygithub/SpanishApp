import { dayAt, phaseOf, TOTAL_DAYS } from '../data'
import { addDays, localISO, weekdayShort } from '../dates'
import { advanceEarly, coverage, counted, MIN_INPUT, settleDay, streak } from '../habit'
import { isDone, S, save, setDone, today } from '../state'
import { dueCards, dueCount, known, newCardsUpTo } from '../srs'
import { sfx, toast } from '../feel'
import { $, $$, app, esc, icon } from '../ui'
import { isIOS, isStandalone, notifyDone } from '../push'
import { startSession } from './session'

let listen: { start: number; t: number; logged: number } | null = null
// The listening timer survives the app being closed while you watch something elsewhere.
try { const v = JSON.parse(localStorage.getItem('hoy-listen') || 'null'); if (v) listen = { start: v.start, logged: v.logged, t: window.setInterval(() => tickListening(), 1000) } } catch { /* ignore */ }
const keepListen = () => { try { localStorage.setItem('hoy-listen', JSON.stringify(listen ? { start: listen.start, logged: listen.logged } : null)) } catch { /* ignore */ } }

export function renderToday(go: () => void) {
  settleDay()
  const day = dayAt(S.dayIdx), ph = phaseOf(day), st = streak(), t = localISO()
  const due = Math.min(dueCards().length, S.settings.reviewCap), fresh = Math.min(newCardsUpTo(S.dayIdx).length, 10)
  const est = Math.max(5, Math.round(due * 0.15 + fresh * 0.9))
  const coreDone = !!S.dayDoneOn[S.dayIdx]
  const away = st.daysAway >= 2 && !st.todayCounted

  const title = st.todayCounted ? (coreDone ? 'Day done' : 'Today counts') : away ? 'Welcome back' : st.streak > 0 ? 'Keep it rolling' : 'Ready when you are'
  const lede = away
    ? `No catching up needed. Day ${S.dayIdx} is right where you left it, and five minutes is plenty.`
    : st.todayCounted
      ? coreDone ? 'Anything else today is a bonus.' : 'Anything more is a bonus. Your words for today are still here if you want them.'
      : due + fresh === 0 ? 'Nothing due. A quick practice round or some listening makes today count.' : `${due ? `${due} review${due > 1 ? 's' : ''}` : ''}${due && fresh ? ' · ' : ''}${fresh ? `${fresh} new word${fresh > 1 ? 's' : ''}` : ''} · about ${est} min`

  const week = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6)).map((d) => {
    const cls = counted(d) ? 'done' : st.frozen.has(d) ? 'frozen' : ''
    return `<div class="d"><div class="dot ${cls} ${d === t ? 'today' : ''}">${cls === 'done' ? icon('check') : cls === 'frozen' ? icon('snow') : ''}</div>${weekdayShort(d)}</div>`
  }).join('')

  const cov = coverage()
  const bonus = day.tasks.filter((k) => !['ak', 'quiz'].includes(k.k))
  const tl = today()

  app().innerHTML = `
    <p class="context">Day ${S.dayIdx} of ${TOTAL_DAYS} · Week ${day.w} · ${esc(ph.name)}</p>
    <h1 class="display">${title}</h1>
    <p class="lede">${lede}</p>
    <div class="week" aria-label="Last 7 days">${week}</div>
    <div class="tiles">
      <div class="tile"><div class="big num" style="color:${st.streak ? 'var(--accent)' : 'var(--ink-subtle)'}">${icon('flame')}${st.streak}</div><div class="lbl">day streak${st.freezes ? ` · ${icon('snow').replace('<svg', '<svg style="width:12px;height:12px;vertical-align:-1px"')} ${st.freezes}` : ''}</div></div>
      <div class="tile"><div class="big num">${known()}</div><div class="lbl">words${cov.pct ? ` · ~${cov.pct}% of everyday speech` : ` · ${cov.next[0]} unlocks ~${cov.next[1]}%`}</div></div>
    </div>
    ${tl.learned || coreDone ? `<div class="card" style="margin-top:12px"><div class="title">${tl.learned} new word${tl.learned === 1 ? '' : 's'} learned today${tl.reviewed ? ` · ${tl.reviewed} reviewed` : ''}</div>
      <p class="muted small" style="margin:4px 0 0">${coreDone ? `Day ${S.dayIdx} is done and saved. ` : ''}Tomorrow: ${dueCount(1)} review${dueCount(1) === 1 ? '' : 's'}${coreDone && S.dayIdx < TOTAL_DAYS && !dayAt(S.dayIdx + 1).rv ? ` + Day ${S.dayIdx + 1}'s new words` : ''}, ready at midnight.</p>
      ${coreDone && S.dayIdx < TOTAL_DAYS && !day.rv && newCardsUpTo(S.dayIdx + 1).length ? `<button class="btn small" id="ahead" style="margin-top:12px">Learn Day ${S.dayIdx + 1}'s words now</button>` : ''}</div>` : ''}
    ${!isStandalone() && isIOS() ? `<div class="card" style="margin-top:12px;display:flex;gap:12px;align-items:center">${icon('share')}<div class="grow small">Open the app from the Home Screen icon only: progress made in Safari is stored separately and won't appear there. Share → Add to Home Screen. Turning on Sync in Settings keeps both in step.</div></div>` : ''}

    <p class="section-label">Also today, if you want</p>
    <ul class="rows card">
      ${bonus.map((k) => {
        const on = isDone(S.dayIdx, k.k)
        const isInput = k.k === 'in'
        return `<li class="row ${on ? 'done' : ''}">
          <button class="check ${on ? 'on' : ''}" data-k="${k.k}" aria-label="Mark ${esc(k.t)} ${on ? 'not done' : 'done'}" aria-pressed="${on}">${icon('check')}</button>
          <div class="grow"><div class="t">${esc(k.t)}</div><div class="d">${esc(k.d)}</div>
            ${isInput ? `<div class="links"><button class="btn small" id="listen">${listen ? `${icon('pause')}<span id="ltxt" class="num">Listening…</span>` : `${icon('headphones')} Start listening timer`}</button><button class="btn small" id="add15">+15 min</button></div><div class="d" style="margin-top:6px">${tl.inputMin} min logged today${tl.inputMin < MIN_INPUT && !st.todayCounted ? ` · ${MIN_INPUT} min makes today count` : ''}</div>` : ''}
            ${k.l?.length ? `<div class="links">${k.l.map(([lab, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(lab)}</a>`).join('')}</div>` : ''}
          </div></li>`
      }).join('')}
    </ul>
    <div class="dock"><button class="btn primary" id="start">${icon('play')} ${st.todayCounted ? 'Keep going' : 'Start'}<span style="opacity:.65;font-weight:600">&nbsp;· ${st.todayCounted ? 'bonus' : '5 min'}</span></button></div>`

  $('#start').onclick = () => startSession(go)
  const ahead = document.getElementById('ahead'); if (ahead) ahead.onclick = () => { advanceEarly(); startSession(go) }
  $$('.check').forEach((b) => (b.onclick = () => {
    const k = b.dataset.k!; const on = !isDone(S.dayIdx, k); setDone(S.dayIdx, k, on)
    if (on) sfx.right(0); go()
  }))
  const l = document.getElementById('listen')
  if (l) l.onclick = () => { if (listen) stopListening(go); else { listen = { start: Date.now(), t: 0, logged: 0 }; listen.t = window.setInterval(() => tickListening(), 1000); keepListen(); go() } }
  const a = document.getElementById('add15')
  if (a) a.onclick = () => { logMinutes(15); toast('15 minutes logged'); go() }
  tickListening()
}

function logMinutes(n: number) {
  const before = counted(localISO())
  today().inputMin += n; save()
  if (!before && counted(localISO())) { sfx.done(); toast('Today counts. Nice listening.'); notifyDone(streak().streak) }
}
function tickListening() {
  if (!listen) return
  const sec = Math.floor((Date.now() - listen.start) / 1000)
  const mins = Math.floor(sec / 60)
  if (mins > listen.logged) { logMinutes(mins - listen.logged); listen.logged = mins; keepListen() }
  const el = document.getElementById('ltxt'); if (el) el.textContent = `${mins}:${String(sec % 60).padStart(2, '0')} · stop`
}
function stopListening(go: () => void) {
  if (!listen) return
  clearInterval(listen.t); tickListening()
  const n = listen.logged; listen = null; keepListen()
  if (n && !isDone(S.dayIdx, 'in')) setDone(S.dayIdx, 'in', n >= 15)
  toast(n ? `${n} minute${n > 1 ? 's' : ''} of listening logged` : 'Timer stopped'); go()
}
