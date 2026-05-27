import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist, NetworkOnly } from 'serwist'

// Tell TypeScript that `self` inside a service worker has the right shape.
// We extend WorkerGlobalScope (from lib.dom) rather than ServiceWorkerGlobalScope
// (from lib.webworker, which conflicts with lib.dom in the shared tsconfig).
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: WorkerGlobalScope & typeof globalThis

// Supabase calls are user-specific and realtime — never cache them.
// This rule is prepended so it takes priority over defaultCache's
// cross-origin NetworkFirst rule.
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
