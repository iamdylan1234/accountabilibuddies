'use client'

import { useState } from 'react'
import { useBuzzPermission, type EnableResult } from '@/lib/push/useBuzzPermission'
import { firstNameOf } from '@/lib/profile'
import type { Profile } from '@/types/database'

interface Props {
  buddy: Profile | null
}

/**
 * Notification toggle on /profile. Always visible when push is supported,
 * regardless of the Today-tab banner's dismissal state — explicit user
 * intent here overrides "not now" on the banner.
 */
export default function BuzzToggle({ buddy }: Props) {
  const state = useBuzzPermission()
  const [error, setError] = useState<string | null>(null)

  if (state.kind === 'unsupported' || state.kind === 'ios-needs-install') return null

  // Wrap an enable() call so a failure surfaces its reason instead of silently
  // doing nothing.
  const runEnable = (enable: () => Promise<EnableResult>) => async () => {
    setError(null)
    const res = await enable()
    if (res && !res.ok) setError(res.reason)
  }

  let caption: string
  let toggleOn = false
  let toggleDisabled = false
  let onClick: (() => void) | undefined

  switch (state.kind) {
    case 'denied':
      caption = 'Blocked in browser settings. Re-enable via your browser/OS notification settings for this site.'
      toggleDisabled = true
      break
    case 'pending':
      caption = 'Saving…'
      toggleDisabled = true
      break
    case 'default':
      caption = 'Off — tap to enable'
      onClick = runEnable(state.enable)
      break
    case 'granted':
      if (state.subscribed) {
        const firstName = buddy ? firstNameOf(buddy) : 'your buddy'
        caption = `On — buzzes from ${firstName}`
        toggleOn = true
        onClick = () => { void state.disable() }
      } else {
        caption = 'Off — tap to enable'
        onClick = runEnable(state.enable)
      }
      break
  }

  return (
    <div className="mt-8 bg-white rounded-2xl border border-gray-200 p-4">
      <button
        type="button"
        onClick={onClick}
        disabled={toggleDisabled}
        aria-label="Buddy buzzes"
        className="w-full flex items-center justify-between gap-3 disabled:opacity-60"
      >
        <div className="flex-1 text-left min-w-0">
          <p className="font-bold text-sm text-gray-900">Buddy buzzes</p>
          <p className={`text-xs ${error ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>{error ?? caption}</p>
        </div>
        <span
          className={`relative w-11 h-6 rounded-full transition flex-shrink-0 ${toggleOn ? 'bg-teal-500' : 'bg-gray-300'}`}
          aria-hidden="true"
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition ${toggleOn ? 'translate-x-5' : ''}`}
          />
        </span>
      </button>
    </div>
  )
}
