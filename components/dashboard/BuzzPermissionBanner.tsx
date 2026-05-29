'use client'

import { useEffect, useState } from 'react'
import { useBuzzPermission } from '@/lib/push/useBuzzPermission'
import { firstNameOf } from '@/lib/profile'
import { BRAND_GRADIENT } from '@/lib/brand'
import type { Profile } from '@/types/database'

const DISMISS_KEY = 'accountabilibuddies-buzz-banner-dismissed-until'
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 14 // 14 days

interface Props {
  buddy: Profile | null
}

/**
 * Today-tab banner that asks the recipient to enable buddy buzz push
 * notifications. Shown only when: a buddy exists, permission is "default"
 * (never asked), and the banner hasn't been dismissed in the last 14 days.
 *
 * Mirrors the visual pattern of <InstallBanner /> so they feel like one
 * family of opt-in prompts.
 */
export default function BuzzPermissionBanner({ buddy }: Props) {
  const state = useBuzzPermission()
  const [dismissedHydrated, setDismissedHydrated] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (raw && Number(raw) > Date.now()) setDismissed(true)
    setDismissedHydrated(true)
  }, [])

  if (!buddy) return null
  if (!dismissedHydrated) return null
  if (dismissed) return null
  // Normally only show on 'default'. But if an enable attempt just failed, keep
  // the banner up so the user can read WHY (permission may have flipped to
  // 'denied', which would otherwise hide the banner and lose the message).
  if (!error && state.kind !== 'default') return null

  const firstName = firstNameOf(buddy)

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_TTL_MS))
    setDismissed(true)
  }

  async function handleEnable() {
    if (state.kind !== 'default') return
    setBusy(true)
    setError(null)
    const res = await state.enable()
    setBusy(false)
    if (res && !res.ok) setError(res.reason)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mt-3">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
          style={{ background: BRAND_GRADIENT }}
        >
          🤜🤛
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-gray-900">Get a buzz from {firstName}</p>
          <p className="text-xs text-gray-500">A notification when {firstName} sends a message. Tap to read.</p>
          {error && <p className="text-xs text-red-600 font-semibold mt-1">{error}</p>}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-gray-400 text-lg leading-none px-1"
        >
          ×
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={handleDismiss}
          className="flex-1 py-2 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 transition active:scale-95"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={handleEnable}
          disabled={busy || state.kind !== 'default'}
          style={{ background: BRAND_GRADIENT }}
          className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition active:scale-95 disabled:opacity-60"
        >
          {busy ? 'Enabling…' : 'Enable'}
        </button>
      </div>
    </div>
  )
}
