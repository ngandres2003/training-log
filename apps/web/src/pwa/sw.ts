/// <reference lib="webworker" />
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import type { RestEndMessage } from './notify'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | { url: string; revision: string | null })[]
}

// App shell plus the exercise catalog JSON, so the app opens and lists exercises offline.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA fallback: every route is served by the precached index.html. /api/ is never cached.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }))

// Catalog and custom-exercise images on Vercel Blob. Images loaded without CORS come back
// opaque (status 0), which the default CacheFirst rules would refuse to cache.
registerRoute(
  ({ url, request }) =>
    request.destination === 'image' && url.hostname.endsWith('.public.blob.vercel-storage.com'),
  new CacheFirst({
    cacheName: 'blob-images',
    plugins: [
      { cacheWillUpdate: async ({ response }) => (response.ok || response.status === 0 ? response : null) },
      new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 90, purgeOnQuotaError: true }),
    ],
  }),
)

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Rest-end notification. Only the latest schedule counts. The timeout runs only while
// the browser keeps the worker alive; the page recomputes from restEndsAt on return.
let cancelPendingRest: (() => void) | null = null

async function showRestEnd(title: string, body: string) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  // A visible page vibrates and beeps by itself.
  if (windows.some((client) => client.visibilityState === 'visible')) return
  await self.registration.showNotification(title, {
    body,
    tag: 'rest-end',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
  })
}

self.addEventListener('message', (event) => {
  const data = event.data as RestEndMessage | { type: 'SKIP_WAITING' } | undefined
  if (!data) return

  if (data.type === 'SKIP_WAITING') {
    void self.skipWaiting()
    return
  }

  if (data.type === 'cancel-rest-end' || data.type === 'schedule-rest-end') {
    cancelPendingRest?.()
    cancelPendingRest = null
  }

  if (data.type === 'schedule-rest-end') {
    const { at, title, body } = data
    event.waitUntil(
      new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          cancelPendingRest = null
          showRestEnd(title, body).finally(resolve)
        }, Math.max(0, at - Date.now()))
        cancelPendingRest = () => {
          clearTimeout(timer)
          resolve()
        }
      }),
    )
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows[0]
      return existing ? existing.focus() : self.clients.openWindow('/')
    }),
  )
})
