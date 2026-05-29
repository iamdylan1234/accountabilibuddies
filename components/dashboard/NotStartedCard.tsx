'use client'

import { BRAND_GRADIENT } from '@/lib/brand'
import { formatDate, daysBetween } from '@/lib/dateUtils'

interface Props {
  challengeId: string
  challengeName: string
  startDate: string   // "YYYY-MM-DD"
  myName: string
  buddyName: string
}

/** "June 1" from a YYYY-MM-DD string (local, no year). */
function startLine(startDate: string): string {
  const [y, m, d] = startDate.split('-').map(Number)
  if (!y || !m || !d) return ''
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

/** "3 days to go" / "Starts tomorrow" / "Starts today" from days-until-start. */
function countdownLabel(days: number): string {
  if (days <= 0) return 'Starts today'
  if (days === 1) return 'Starts tomorrow'
  return `${days} days to go`
}

/**
 * Shown on Today when the user's challenge is active in the data model but its
 * start_date hasn't arrived yet (a scheduled future start, e.g. June 1). Replaces
 * the checkable board with a countdown so no check-ins happen before day 1. The
 * counter is computed from the browser's local date (same source the live board
 * uses for `today`), so it's always fresh. Goals remain editable until start —
 * hence the "Review your goals" link.
 */
export default function NotStartedCard({ challengeId, challengeName, startDate, myName, buddyName }: Props) {
  const days = daysBetween(formatDate(new Date()), startDate)

  return (
    <div className="rounded-2xl p-6 text-white text-center shadow-sm" style={{ background: BRAND_GRADIENT }}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Challenge scheduled</p>
      <h2 className="text-xl font-black mt-1">{challengeName}</h2>

      <p className="text-3xl font-black mt-4 leading-none">{countdownLabel(days)}</p>
      <p className="text-sm text-white/80 mt-2">🗓️ Starts {startLine(startDate)}</p>

      <p className="text-sm text-white/90 mt-4">{myName} &amp; {buddyName} are all set.</p>

      <a
        href={`/setup?challenge=${challengeId}`}
        className="inline-block mt-5 text-sm font-bold underline underline-offset-4 text-white/90 active:opacity-70"
      >
        Review your goals →
      </a>
    </div>
  )
}
