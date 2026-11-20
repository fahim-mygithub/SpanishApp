import { localISO } from '../dates'
import { S, save } from '../state'
import { allCards, dueCards, known, newCardsUpTo } from '../srs'
import { say, toast } from '../feel'
import { $, $$, app, esc, icon } from '../ui'
import { startSession } from './session'

let filter = ''

export function renderWords(go: () => void) {
  const due = dueCards().length, fresh = newCardsUpTo(S.dayIdx).length
  const learned = allCards().filter((c) => S.srs[c.id])
  const shown = learned.filter((c) => !filter || c.es.toLowerCase().includes(filter) || c.en.toLowerCase().includes(filter))
    .sort((a, b) => (S.srs[a.id].due < S.srs[b.id].due ? -1 : 1)).slice(0, 80)
  const when = (iso: string) => { const d = iso.slice(0, 10); const t = localISO(); return d <= t ? 'due' : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }

  app().innerHTML = `
    <p class="context">Your deck</p>
    <h1 class="display">Words</h1>
    <div class="tiles" style="grid-template-columns:repeat(3,1fr)">
      <div class="tile"><div class="big num">${known()}</div><div class="lbl">learned</div></div>
      <div class="tile"><div class="big num" style="color:${due ? 'var(--accent)' : 'inherit'}">${due}</div><div class="lbl">due today</div></div>
      <div class="tile"><div class="big num">${fresh}</div><div class="lbl">new waiting</div></div>
    </div>
    <div class="card" style="margin-top:12px">
      <div class="title">Extra practice</div>
      <p class="muted small" style="margin:4px 0 12px">Quiz yourself on words you know. It never changes your review schedule, so there's no downside to doing more.</p>
      <button class="btn" id="practice" ${known() ? '' : 'disabled'}>${icon('zap')} Practice 10 words</button>
    </div>
    <div class="card">
      <div class="title">Add your own word</div>
      <p class="muted small" style="margin:4px 0 0">Heard something in a video? Add it and it joins your next session.</p>
      <label class="f" for="mEs">Spanish</label><input class="input" id="mEs" autocomplete="off" autocapitalize="off">
      <label class="f" for="mEn">English</label><input class="input" id="mEn" autocomplete="off">
      <button class="btn" id="mAdd" style="margin-top:14px">${icon('plus')} Add</button>
    </div>
    <p class="section-label">Learned</p>
    <input class="input" id="q" placeholder="Search Spanish or English" value="${esc(filter)}" autocomplete="off" aria-label="Search words">
    <ul class="rows" style="margin-top:8px">
      ${shown.map((c) => `<li class="row"><button class="icon-btn" data-say="${esc(c.es)}" aria-label="Play ${esc(c.es)}">${icon('speak')}</button><div class="grow"><div class="t">${esc(c.es)}</div><div class="d">${esc(c.en)}</div></div><span class="muted small num">${when(S.srs[c.id].due)}</span></li>`).join('') || `<li class="row muted">No words yet. Tap Start on Today to learn your first ten.</li>`}
    </ul>
    ${learned.length > shown.length && !filter ? `<p class="muted small">Showing the 80 coming up soonest. Search to find others.</p>` : ''}`

  $('#practice').onclick = () => startSession(go, 'practice')
  $('#mAdd').onclick = () => {
    const es = $<HTMLInputElement>('#mEs').value.trim(), en = $<HTMLInputElement>('#mEn').value.trim()
    if (!es || !en) { toast('Fill in both sides'); return }
    S.mined.push({ id: `m${Date.now().toString(36)}`, es, en, day: S.dayIdx, w: Math.ceil(S.dayIdx / 7), t: Date.now() }); save()
    toast('Added. It’s first in your next session.'); go()
  }
  const q = $<HTMLInputElement>('#q')
  q.oninput = () => { filter = q.value.trim().toLowerCase(); const pos = q.selectionStart; go(); const n = $<HTMLInputElement>('#q'); n.focus(); n.setSelectionRange(pos, pos) }
  $$('[data-say]').forEach((b) => (b.onclick = () => say(b.dataset.say!)))
}
