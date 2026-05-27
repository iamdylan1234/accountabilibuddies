'use client'

import { useEffect, useState } from 'react'
import { BRAND_GRADIENT } from '@/lib/brand'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'install-banner-dismissed-at'
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 14 // 14 days

/**
 * Bottom-of-page banner that captures the browser's beforeinstallprompt event
 * (Chrome / Edge / Samsung Browser) and lets the user install the app via a
 * clear in-app tap. iOS Safari doesn't fire this event — those users still
 * get the Add-to-Home-Screen affordance via Safari's share menu.
 *
 * Dismissed state is persisted for 14 days so we don't nag.
 */
export default function InstallBanner() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    // Already installed — never show
    if (window.matchMedia('(display-mode: standalone)').matches) return

    // Recently dismissed — respect the TTL
    const dismissedAtStr = localStorage.getItem(DISMISS_KEY)
    if (dismissedAtStr) {
      const dismissedAt = Number(dismissedAtStr)
      if (Date.now() - dismissedAt < DISMISS_TTL_MS) return
    }

    function handler(e: Event) {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
      setHidden(false)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setHidden(true)
  }

  async function install() {
    if (!event) return
    await event.prompt()
    const { outcome } = await event.userChoice
    if (outcome === 'accepted') {
      // Browser handles the install. Hide the banner.
      setHidden(true)
    } else {
      // User declined — respect the dismissal TTL
      dismiss()
    }
    setEvent(null)
  }

  if (hidden || !event) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 bg-white rounded-2xl shadow-lg p-4 border border-gray-200 max-w-md mx-auto">
      <div className="flex items-center gap-3">
        <img src="/icon.png" alt="" className="w-12 h-12 rounded-lg flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-gray-900">Add to home screen</p>
          <p className="text-xs text-gray-500">Quick access, no browser tabs.</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={dismiss}
          className="flex-1 py-2 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 transition active:scale-95"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={install}
          style={{ background: BRAND_GRADIENT }}
          className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition active:scale-95"
        >
          Install
        </button>
      </div>
    </div>
  )
}
