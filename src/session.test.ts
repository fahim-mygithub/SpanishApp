import { beforeEach, expect, it } from 'vitest'
import { fresh, replace, S } from './state'
import { startSession } from './views/session'
import { renderToday } from './views/today'

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div><nav id="tabs"></nav><div id="toast"></div>'
  ;(window as any).matchMedia = () => ({ matches: false })
  window.scrollTo = () => {}
  replace(fresh())
})
const $ = (s: string) => document.querySelector(s) as HTMLElement | null

it('a first session teaches day 1 end to end and counts the day', async () => {
  let exited = false
  renderToday(() => {})
  expect($('h1')!.textContent).toBe('Ready when you are')
  startSession(() => { exited = true })
  for (let i = 0; i < 300; i++) {
    if ($('#gotit')) { $('#gotit')!.click(); continue }
    const step = (window as any).__hoyStep
    if ($('.opt')) {
      const opts = [...document.querySelectorAll<HTMLElement>('.opt')]
      const want = (window as any).__hoyStep && $('.word') && $('.word')!.textContent === step.c.es ? step.c.en : step.c.es
      ;(opts.find((b) => b.textContent === want) || opts.find((b) => b.textContent === step.c.en) || opts[0]).click(); $('#next')!.click(); continue
    }
    if ($('#typed')) { ($('#typed') as HTMLInputElement).value = step.c.es.split('/')[0].trim(); $('#check')!.click(); $('#next')!.click(); continue }
    if ($('#done')) break
  }
  expect($('#done')).not.toBeNull()
  expect(Object.keys(S.srs).length).toBe(10)
  expect(S.dayDoneOn[1]).toBeTruthy()
  expect($('h1')!.textContent).toBe('Today counts')
  $('#done')!.click(); expect(exited).toBe(true)
})
