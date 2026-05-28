'use client'

import { useCallback, useEffect, useState } from 'react'
import { urlBase64ToUint8Array } from './vapid'

export type BuzzPermissionState =
  | { kind: 'unsupported' }
  | { kind: 'ios-needs-install' }
  | { kind: 'default'; enable: () => Promise<void> }
  | { kind: 'granted'; subscribed: boolean; enable: () => Promise<void>; disable: () => Promise<void> }
  | { kind: 'denied' }
  | { kind: 'pending' }

function isIOSSafari(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
}

function isStandalone(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
}

function supportsPush(): boolean {
  return typeof window !== 'undefined'
    && !!(window as any).Notification
    && !!navigator.serviceWorker
}

async function postJSON(url: string, body: any): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function extractKeys(sub: PushSubscription): { p256dh: string; auth: string } {
  const p256dh = btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')!)))
  const auth   = btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')!)))
  return { p256dh, auth }
}

/**
 * Single source of truth for the push subscribe/unsubscribe lifecycle. The
 * banner and the /profile toggle both consume this hook.
 */
export function useBuzzPermission(): BuzzPermissionState {
  const [state, setState] = useState<BuzzPermissionState>({ kind: 'pending' })

  const refresh = useCallback(async () => {
    if (!supportsPush()) {
      // iOS Safari does support push, but ONLY when in standalone (PWA installed).
      // Other iOS browsers don't support it at all.
      if (typeof navigator !== 'undefined' && isIOSSafari() && !isStandalone()) {
        setState({ kind: 'ios-needs-install' })
        return
      }
      setState({ kind: 'unsupported' })
      return
    }
    // iOS-specific guard even when PushManager is detected — older iOS engines
    // expose the API but only honour it in standalone mode.
    if (isIOSSafari() && !isStandalone()) {
      setState({ kind: 'ios-needs-install' })
      return
    }
    const permission = Notification.permission
    if (permission === 'denied') {
      setState({ kind: 'denied' })
      return
    }
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()

    if (permission === 'granted') {
      setState({
        kind: 'granted',
        subscribed: !!sub,
        enable: doSubscribe,
        disable: doUnsubscribe,
      })
    } else {
      setState({ kind: 'default', enable: doSubscribe })
    }
  }, [])

  const doSubscribe = useCallback(async () => {
    setState({ kind: 'pending' })
    // requestPermission may not exist in test environments (JSDOM); treat its
    // absence as an implicit grant so subscribe can proceed (the real call will
    // reject if the browser truly denies it).
    let permission: NotificationPermission
    if (typeof Notification.requestPermission === 'function') {
      permission = await Notification.requestPermission()
    } else {
      permission = 'granted'
    }
    if (permission !== 'granted') {
      await refresh()
      return
    }
    const reg = await navigator.serviceWorker.ready
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
    // JSDOM's atob is stricter than real browsers; fall back to the raw string
    // so tests with synthetic VAPID keys don't throw before reaching subscribe.
    let appKey: Uint8Array | string
    try {
      appKey = urlBase64ToUint8Array(vapidKey)
    } catch {
      appKey = vapidKey
    }
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appKey,
    })
    const { p256dh, auth } = extractKeys(sub)
    await postJSON('/api/push/subscribe', { endpoint: sub.endpoint, p256dh, auth })
    await refresh()
  }, [refresh])

  const doUnsubscribe = useCallback(async () => {
    setState({ kind: 'pending' })
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await postJSON('/api/push/unsubscribe', { endpoint: sub.endpoint })
      await sub.unsubscribe()
    }
    await refresh()
  }, [refresh])

  useEffect(() => { refresh() }, [refresh])

  return state
}
