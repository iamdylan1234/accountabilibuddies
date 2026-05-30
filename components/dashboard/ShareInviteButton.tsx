'use client'

import { useEffect, useState } from 'react'
import { BRAND_GRADIENT } from '@/lib/brand'

interface Props {
  inviteUrl: string
  creatorName: string  // first name
  challengeName: string
}

/**
 * One-tap native invite share on the pending "Waiting for your buddy" screen.
 *
 * On browsers that support the Web Share API (mobile Safari/Chrome on iOS &
 * Android), surfaces a primary share button that opens the OS share sheet —
 * collapsing the biggest first-time friction step (out-of-band relay through
 * WhatsApp/SMS/etc.) into a single tap. On unsupported browsers (most desktop),
 * renders nothing and the user falls through to the existing copy block below.
 *
 * `navigator.share` doesn't exist on the server, so support is resolved in a
 * post-mount effect. The initial render returns null (no SSR ghost button),
 * and the button appears on hydration only if supported — no layout shift on
 * desktop, additive on mobile.
 */
export default function ShareInviteButton({ inviteUrl, creatorName, challengeName }: Props) {
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    setSupported(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  if (!supported) return null

  async function handleShare() {
    try {
      await navigator.share({
        title: `${creatorName} wants you as their accountability buddy`,
        text:  `Join my ${challengeName} on Accountabilibuddies — 30 days, one buddy, no excuses.`,
        url:   inviteUrl,
      })
    } catch (err: unknown) {
      // User cancelled the share sheet → AbortError; ignore it.
      // Log anything else so a real failure isn't silently swallowed.
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[ShareInviteButton] share failed:', err)
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition active:scale-95 flex items-center justify-center gap-2 shadow-sm mb-4"
      style={{ background: BRAND_GRADIENT }}
    >
      <span>Share invite</span>
      <span aria-hidden="true">→</span>
    </button>
  )
}
