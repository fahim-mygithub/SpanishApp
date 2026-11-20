/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
self.addEventListener('install', () => { void self.skipWaiting() })
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

// SPA fallback: any navigation inside the app scope gets the cached shell (works offline).
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return
  const scope = new URL(self.registration.scope)
  if (!e.request.url.startsWith(scope.href)) return
  e.respondWith(fetch(e.request).catch(async () => (await caches.match(scope.href + 'index.html', { ignoreSearch: true })) || (await caches.match(scope.href, { ignoreSearch: true })) || Response.error()))
})

// Daily reminder from the Worker.
self.addEventListener('push', (e) => {
  let data: { title?: string; body?: string; tag?: string } = {}
  try { data = e.data?.json() ?? {} } catch { data = { body: e.data?.text() } }
  const scope = self.registration.scope
  e.waitUntil(self.registration.showNotification(data.title || 'Hoy', {
    body: data.body || 'Five minutes of Spanish? Your words are ready.',
    icon: scope + 'icon-192.png', badge: scope + 'icon-192.png',
    tag: data.tag || 'daily', data: { url: scope + '?start=1' },
  }))
})

// Tap → open the app straight into a session (lowest-friction start).
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) { await (w as WindowClient).focus(); w.postMessage({ type: 'start' }); return }
    }
    await self.clients.openWindow(url)
  })())
})
