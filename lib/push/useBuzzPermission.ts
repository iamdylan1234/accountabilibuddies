'use client'

import { useCallback, useEffect, useState } from 'react'
import { urlBase64ToUint8Array } from './vapid'

/**
 * Outcome of an enable() attempt. On failure it carries a human-readable
 * reason so the banner / toggle can tell the user WHY enabling didn't work
 * (blocked, dismissed, or a technical error) instead of failing silently.
 */
export type EnableResult = { ok: true } | { ok: false; reason: string }

export type BuzzPermissionState =
  | { kind: 'unsupported' }
  | { kind: 'ios-needs-install' }
  | { kind: 'default'; enable: () => Promise<EnableResult> }
  | { kind: 'granted'; subscribed: boolean; enable: () => Promise<EnableResult>; disable: () => Promise<void> }
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
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window
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

  const doSubscribe = useCallback(async (): Promise<EnableResult> => {
    setState({ kind: 'pending' })
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      await refresh()
      return {
        ok: false,
        reason: permission === 'denied'
          ? 'Notifications are blocked. Turn them on in your browser settings for this site, then try again.'
          : 'Notifications weren’t enabled. Tap Enable to try again.',
      }
    }
    try {
      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      const { p256dh, auth } = extractKeys(sub)
      const res = await postJSON('/api/push/subscribe', { endpoint: sub.endpoint, p256dh, auth })
      if (!res.ok) {
        await refresh()
        return { ok: false, reason: 'Couldn’t save your subscription. Please try again.' }
      }
    } catch {
      await refresh()
      return { ok: false, reason: 'Couldn’t enable notifications. Please try again.' }
    }
    await refresh()
    return { ok: true }
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
