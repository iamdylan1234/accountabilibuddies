'use client'

import { BRAND_GRADIENT } from '@/lib/brand'

interface Props {
  inviteUrl: string
  creatorName: string  // first name
  challengeName: string
}

/**
 * One-tap invite share on the "Waiting for your buddy" screen.
 *
 * Always renders — no copy/paste fall-off step. Behaviour branches at click time:
 *
 *  - Web Share API supported (most mobile browsers, modern Safari/Chrome):
 *    OS share sheet — user picks WhatsApp / iMessage / Telegram / etc.
 *  - Not supported (Firefox desktop, older browsers) OR native share fails:
 *    Falls back to opening WhatsApp Web/Desktop with the message prefilled
 *    (the dominant chat app for the current user base; covers desktop without
 *    forcing the user into copy/paste).
 *
 * Capability detection happens at click time (not mount) so SSR doesn't try
 * to read `navigator` and there's no hydration mismatch.
 */
export default function ShareInviteButton({ inviteUrl, creatorName, challengeName }: Props) {
  // Single combined string for the WhatsApp fallback (wa.me joins title/body
  // into one `text` query param). Native share gets title/text/url separately
  // so the OS sheet can render the link as a rich attachment.
  const shortMessage = `Join my ${challengeName} on Accountabilibuddies — 30 days, one buddy, no excuses.`
  const fallbackText = `${shortMessage}\n${inviteUrl}`

  async function handleShare() {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `${creatorName} wants you as their accountability buddy`,
          text:  shortMessage,
          url:   inviteUrl,
        })
        return
      } catch (err: unknown) {
        // User cancelled the share sheet → AbortError; we're done, don't open
        // WhatsApp as well (would feel like spam). Other errors fall through
        // so the user is never dead-ended.
        if (err instanceof Error && err.name === 'AbortError') return
        console.error('[ShareInviteButton] native share failed, falling back to WhatsApp:', err)
      }
    }
    // Fallback: WhatsApp Web/Desktop with message + link prefilled. Works on
    // any platform; if WhatsApp app is installed it opens that instead.
    window.open(
      `https://wa.me/?text=${encodeURIComponent(fallbackText)}`,
      '_blank',
      'noopener,noreferrer',
    )
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
