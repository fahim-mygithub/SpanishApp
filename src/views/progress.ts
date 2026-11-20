import { dayAt, PLAN, phaseOf } from '../data'
import { COVERAGE, coverage, DS_LEVELS, dsLevel, inputHours, level, streak, totalXP } from '../habit'
import { S, save, today } from '../state'
import { known } from '../srs'
import { toast } from '../feel'
import { $$, app, esc, icon, sheet } from '../ui'
import { startSession } from './session'

export function renderProgress(go: () => void) {
  const st = streak(), lv = level(), n = known(), cov = coverage(n), h = inputHours(), ds = dsLevel(h)
  const lastMs = COVERAGE[COVERAGE.length - 1][0]
  const curWeek = dayAt(S.dayIdx).w
  const weeks = Array.from({ length: curWeek }, (_, i) => i + 1).reverse()

  app().innerHTML = `
    <p class="context">Level ${lv.lv} · ${totalXP().toLocaleString()} XP</p>
    <h1 class="display">Progress</h1>
    <div class="bar amber" aria-label="Level progress"><span style="width:${Math.round((lv.into / lv.need) * 100)}%"></span></div>
    <p class="muted small" style="margin:6px 0 0">${lv.need - lv.into} XP to level ${lv.lv + 1}</p>

    <div class="tiles">
      <div class="tile"><div class="big num" style="color:var(--accent)">${icon('flame')}${st.streak}</div><div class="lbl">streak · best ${st.best}</div></div>
      <div class="tile"><div class="big num">${icon('snow')}${st.freezes}</div><div class="lbl">streak freezes (max 2)</div></div>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="title">${n} words</div>
      <p class="muted small" style="margin:4px 0 12px">${cov.pct ? `Roughly ${cov.pct}% of the words in everyday spoken Spanish. ` : ''}${n < lastMs ? `${cov.next[0] - n} more to reach about ${cov.next[1]}%.` : ''}</p>
      <div class="bar"><span style="width:${Math.min(100, (n / 1000) * 100)}%"></span></div>
      <div class="milestones num">${COVERAGE.slice(0, 4).map(([w, p]) => `<span class="${n >= w ? 'hit' : ''}">${w} · ${p}%</span>`).join('')}</div>
    </div>

    <div class="card">
      <div class="title">${h.toFixed(1)} hours listening</div>
      <p class="muted small" style="margin:4px 0 12px">Dreaming Spanish level ${ds.lv}${ds.next[1] > h ? ` · ${Math.ceil(ds.next[1] - h)} h to level ${ds.next[0]}` : ''}. Log time with the listening timer on Today, or add it here.</p>
      <div class="bar"><span style="width:${Math.min(100, ((h - (DS_LEVELS[ds.lv - 1]?.[1] || 0)) / Math.max(1, ds.next[1] - (DS_LEVELS[ds.lv - 1]?.[1] || 0))) * 100)}%"></span></div>
      <div class="links" style="display:flex;gap:8px;margin-top:12px"><button class="btn small" data-add="30">+30 min</button><button class="btn small" data-add="60">+1 hour</button></div>
    </div>

    <p class="section-label">Weekly quizzes</p>
    <ul class="rows card">
      ${weeks.map((w) => { const q = S.quiz[w]; return `<li class="row"><div class="grow"><div class="t">Week ${w}</div><div class="d">${q ? `Best so far ${q.s}/${q.n}` : 'Not taken yet'}</div></div><button class="btn small" data-quiz="${w}">${q ? 'Retake' : 'Take quiz'}</button></li>` }).join('')}
    </ul>

    <p class="section-label">The plan</p>
    ${PLAN.phases.map((p) => `<p class="small" style="margin:16px 0 8px"><b>${esc(p.name)}</b> <span class="muted">· ${esc(p.en)}, weeks ${p.weeks[0]}–${p.weeks[1]}</span></p>
      <div class="map">${PLAN.days.filter((d) => d.p === p.id).map((d) => `<button data-day="${d.i}" class="${d.i === S.dayIdx ? 'cur' : d.i < S.dayIdx ? 'past' : ''}" aria-label="Day ${d.i}">${d.i}</button>`).join('')}</div>`).join('')}`

  $$('[data-add]').forEach((b) => (b.onclick = () => {
    today().inputMin += +b.dataset.add!; save(); toast('Listening time added'); go()
  }))
  $$('[data-quiz]').forEach((b) => (b.onclick = () => startSession(go, 'quiz', +b.dataset.quiz!)))
  $$('[data-day]').forEach((b) => (b.onclick = () => openDay(+b.dataset.day!, go)))
}

function openDay(i: number, go: () => void) {
  const d = dayAt(i), ph = phaseOf(d), words = d.tasks.find((t) => t.w)?.w || []
  sheet(`<p class="context">Week ${d.w} · ${esc(ph.name)}</p><h2 class="display" style="font-size:2rem">Day ${i}${d.rv ? ' · review' : ''}</h2>
    <ul class="rows">${d.tasks.filter((t) => t.k !== 'quiz').map((t) => `<li class="row"><div class="grow"><div class="t">${esc(t.t)}</div><div class="d">${esc(t.d)}</div></div></li>`).join('')}</ul>
    ${words.length ? `<p class="muted small">${words.map(([es]) => esc(es)).join(' · ')}</p>` : ''}
    ${i !== S.dayIdx ? `<button class="btn" id="jump" style="width:100%;margin-top:12px">Move my plan to Day ${i}</button><p class="muted small" style="text-align:center">Words from earlier days you haven't learned yet still come first.</p>` : ''}`,
  (el, close) => { const j = el.querySelector('#jump') as HTMLElement | null; if (j) j.onclick = () => { S.dayIdx = i; save(); close(); toast(`You're on Day ${i}`); go() } })
}
