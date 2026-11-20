import './styles.css'
import { registerSW } from 'virtual:pwa-register'
import { settleDay } from './habit'
import { save } from './state'
import { icon } from './ui'
import { sync } from './sync'
import { inSession, startSession } from './views/session'
import { renderToday } from './views/today'
import { renderWords } from './views/words'
import { renderProgress } from './views/progress'
import { renderSettings } from './views/settings'

type View = 'today' | 'words' | 'progress' | 'settings'
const TABS: [View, string, string][] = [['today', 'sun', 'Today'], ['words', 'layers', 'Words'], ['progress', 'trend', 'Progress'], ['settings', 'settings', 'Settings']]
let view: View = 'today'

function render() {
  if (inSession()) return
  document.body.classList.remove('focus')
  const go = () => render()
  ;({ today: renderToday, words: renderWords, progress: renderProgress, settings: renderSettings })[view](go)
  document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach((b) => b.setAttribute('aria-current', b.dataset.v === view ? 'page' : 'false'))
}
function setView(v: View) { view = v; render(); window.scrollTo(0, 0) }

const nav = document.getElementById('tabs')!
nav.innerHTML = TABS.map(([v, ic, label]) => `<button data-v="${v}">${icon(ic)}<span>${label}</span></button>`).join('')
nav.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.onclick = () => setView(b.dataset.v as View)))

settleDay(); save()
const params = new URLSearchParams(location.search)
if (params.get('start') === '1') {
  history.replaceState(null, '', location.pathname)
  startSession(() => setView('today'))
} else render()

// Pull from GitHub on open and whenever the app comes back to the foreground.
const refresh = () => sync().then(() => { settleDay(); render() })
void refresh()
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void refresh(); else void sync() })

registerSW({ immediate: true })

// The service worker asks the open app to start a session when a reminder is tapped.
navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.type === 'start' && !inSession()) startSession(() => setView('today')) })
