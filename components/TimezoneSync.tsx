'use client'

import { useEffect } from 'react'
import { updateTimezone } from '@/app/dashboard/timezone-actions'

/**
 * Writes the browser's current IANA timezone to the user's profile on mount, but
 * only if it differs from `currentTz` (so we don't write on every load). Renders
 * nothing. Keeps the stored tz fresh for server-side jobs (the completion cron)
 * that have no live client clock to read.
 */
export default function TimezoneSync({ currentTz }: { currentTz: string | null }) {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz && tz !== currentTz) void updateTimezone(tz)
  }, [currentTz])
  return null
}
