import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist, NetworkOnly } from 'serwist'

// Minimal local aliases so we can type push events without pulling in
// lib.webworker (which would conflict with lib.dom in the shared tsconfig).
interface ExtendableEvent extends Event {
  waitUntil(f: Promise<any>): void
}
interface WindowClient {
  url: string
  focus(): Promise<WindowClient>
}
interface ClientsAPI {
  matchAll(options?: { type?: string; includeUncontrolled?: boolean }): Promise<WindowClient[]>
  openWindow(url: string): Promise<WindowClient | null>
}
type PushEvent = ExtendableEvent & {
  data: { json(): any; text(): string } | null
}
type NotificationEvent = ExtendableEvent & {
  notification: Notification
  action: string
}

// Tell TypeScript that `self` inside a service worker has the right shape.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: WorkerGlobalScope & typeof globalThis & {
  registration: ServiceWorkerRegistration
  clients: ClientsAPI
  addEventListener(type: 'push', listener: (e: PushEvent) => void): void
  addEventListener(type: 'notificationclick', listener: (e: NotificationEvent) => void): void
}

// Supabase calls are user-specific and realtime — never cache them.
const supabaseNetworkOnly = {
  matcher: ({ url }: { url: URL }) => url.hostname.endsWith('.supabase.co'),
  handler: new NetworkOnly(),
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [supabaseNetworkOnly, ...defaultCache],
})

serwist.addEventListeners()

// ── Buddy buzz handlers ─────────────────────────────────────────────────────

// Show a notification when a push arrives. The push payload comes from
// `webpush.sendNotification` in lib/push/send.ts.
self.addEventListener('push', (event: PushEvent) => {
  const data = (() => {
    try { return event.data?.json() ?? {} } catch { return {} }
  })()
  const title = data.title ?? 'Accountabilibuddies'
  const body  = data.body  ?? 'Your buddy sent you a buzz'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon.png',
      badge: '/icon.png',
      tag: 'buddy-buzz',
      requireInteraction: false,
    }),
  )
})

// When the user taps the notification, focus the existing tab if open,
// otherwise open a new window to /dashboard.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = all.find((c: WindowClient) => c.url.includes('/dashboard'))
      if (existing) {
        await existing.focus()
        return
      }
      await self.clients.openWindow('/dashboard')
    })(),
  )
})
