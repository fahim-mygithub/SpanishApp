import { S, save } from '../state'
import { toast } from '../feel'
import { $, $$, app, esc, icon } from '../ui'
import { disableReminders, enableReminders, isIOS, isStandalone, pushConfigured, pushId, pushSupported, testReminder, updateReminderTime } from '../push'
import { gh, ghOn, setGh, sync, syncMsg } from '../sync'

export function renderSettings(go: () => void) {
  const on = !!pushId()
  const needsInstall = isIOS() && !isStandalone()
  app().innerHTML = `
    <p class="context">Make it yours</p>
    <h1 class="display">Settings</h1>

    <div class="card">
      <div style="display:flex;align-items:center;gap:12px">${icon('bell')}<div class="grow title">Daily reminder</div>
        <button class="switch" id="pushToggle" role="switch" aria-checked="${on}" aria-label="Daily reminder" ${pushConfigured() ? '' : 'disabled'}></button></div>
      <p class="muted small" style="margin:8px 0 0">One gentle nudge a day, skipped if you've already practised. Tapping it opens straight into a session.</p>
      <label class="f" for="remindAt">Remind me at</label>
      <input class="input" type="time" id="remindAt" value="${esc(S.settings.remindAt)}">
      <p class="muted small" style="margin:8px 0 0">Pick a moment right after something you already do every day, like dinner or your commute home.</p>
      ${!pushConfigured() ? `<p class="small" style="color:var(--accent)">The reminder server isn't connected yet. Follow "Reminders" in the README, then rebuild.</p>` : ''}
      ${needsInstall ? `<p class="small" style="color:var(--accent)">On iPhone, reminders only work from the Home Screen app: Share → Add to Home Screen, then open it from there.</p>` : ''}
      ${on ? `<button class="btn small" id="test" style="margin-top:12px">Send a test reminder</button>` : ''}
    </div>

    <div class="card">
      <ul class="rows">
        <li class="row"><div class="grow"><div class="t">Sounds</div></div><button class="switch" data-set="sound" role="switch" aria-checked="${S.settings.sound}" aria-label="Sounds"></button></li>
        <li class="row"><div class="grow"><div class="t">Vibration</div><div class="d">Android only</div></div><button class="switch" data-set="haptics" role="switch" aria-checked="${S.settings.haptics}" aria-label="Vibration"></button></li>
        <li class="row"><div class="grow"><div class="t">Most reviews per session</div><div class="d">After a break, the rest wait for next time instead of piling up.</div></div>
          <input class="input num" type="number" id="cap" min="5" max="200" value="${S.settings.reviewCap}" style="width:84px;text-align:center"></li>
      </ul>
    </div>

    <div class="card">
      <div class="title">Sync with GitHub</div>
      <p class="muted small" style="margin:4px 0 0">Optional. Saves your progress to a JSON file in a private repo so your phone and laptop share it. The token stays on this device.</p>
      <label class="f" for="gOwner">GitHub username</label><input class="input" id="gOwner" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(gh.owner)}">
      <label class="f" for="gRepo">Private repo</label><input class="input" id="gRepo" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(gh.repo)}">
      <label class="f" for="gTok">Fine-grained token (Contents: read and write, that repo only)</label><input class="input" type="password" id="gTok" autocomplete="off" value="${esc(gh.token)}">
      <div style="display:flex;gap:8px;margin-top:14px"><button class="btn" id="gSave">Save and sync</button>${ghOn() ? `<button class="btn ghost" id="gOff">Disconnect</button>` : ''}</div>
      <p class="muted small" id="gMsg">${esc(syncMsg)}</p>
    </div>

    <p class="muted small" style="margin-top:24px">Spaced repetition by FSRS (ts-fsrs, MIT). Word coverage figures are rounded estimates from subtitle frequency lists.</p>`

  const t = $<HTMLButtonElement>('#pushToggle')
  t.onclick = async () => {
    t.disabled = true
    try {
      if (pushId()) { await disableReminders(); toast('Reminders off') }
      else { if (!pushSupported() && !needsInstall) throw new Error('This browser can’t receive push notifications.'); await enableReminders(); toast('Reminders on') }
    } catch (e) { toast((e as Error).message, 4200) }
    go()
  }
  const ra = $<HTMLInputElement>('#remindAt')
  ra.onchange = async () => { S.settings.remindAt = ra.value || '19:30'; S.settingsAt = Date.now(); save(); try { await updateReminderTime(); toast(`Reminder set for ${ra.value}`) } catch { toast('Saved here, but couldn’t reach the reminder server') } }
  const test = document.getElementById('test'); if (test) test.onclick = async () => { try { await testReminder(); toast('Sent. It should arrive in a few seconds.') } catch (e) { toast((e as Error).message) } }
  $$('[data-set]').forEach((b) => (b.onclick = () => { const k = b.dataset.set as 'sound' | 'haptics'; S.settings[k] = !S.settings[k]; S.settingsAt = Date.now(); save(); go() }))
  const cap = $<HTMLInputElement>('#cap'); cap.onchange = () => { S.settings.reviewCap = Math.max(5, Math.min(200, +cap.value || 25)); S.settingsAt = Date.now(); save() }
  $('#gSave').onclick = async () => {
    setGh({ owner: $<HTMLInputElement>('#gOwner').value.trim(), repo: $<HTMLInputElement>('#gRepo').value.trim() || 'spanish-data', path: gh.path || 'hoy-state.json', token: $<HTMLInputElement>('#gTok').value.trim() })
    $('#gMsg').textContent = 'Syncing…'; await sync(); go()
  }
  const off = document.getElementById('gOff'); if (off) off.onclick = () => { setGh({ ...gh, token: '' }); go() }
}
