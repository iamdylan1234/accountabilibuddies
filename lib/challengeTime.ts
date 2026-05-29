import { addDays } from '@/lib/dateUtils'

/** True if `tz` is an IANA timezone the runtime recognises. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/**
 * Offset (ms) of `timeZone` at instant `atUtc`, defined as wallClock(timeZone) − atUtc.
 * Positive east of UTC, negative west. Used to invert wall-clock → UTC.
 */
function tzOffsetMs(timeZone: string, atUtc: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p: Record<string, string> = {}
  for (const part of dtf.formatToParts(atUtc)) p[part.type] = part.value
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return asUtc - atUtc.getTime()
}

/**
 * The UTC instant when the wall clock in `timeZone` reads 00:00:00 on `dateStr`
 * ("YYYY-MM-DD"). DST-correct via a two-pass offset correction. `null` → UTC.
 */
export function zonedMidnightUtc(dateStr: string, timeZone: string | null): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const naiveUtc = Date.UTC(y, m - 1, d, 0, 0, 0)
  if (!timeZone) return new Date(naiveUtc)
  const o1 = tzOffsetMs(timeZone, new Date(naiveUtc))
  let result = naiveUtc - o1
  const o2 = tzOffsetMs(timeZone, new Date(result))
  // When the offset differs across the boundary (a DST edge at/near this midnight),
  // pick the offset that yields the LATER instant (Math.min — most-negative offset →
  // largest `naiveUtc - offset`). This rounds a non-existent midnight (spring-forward
  // AT 00:00) FORWARD to the first valid instant, so a buddy's final day is never
  // cut short. For ordinary days o1 === o2 and this is a no-op.
  if (o2 !== o1) result = naiveUtc - Math.min(o1, o2)
  return new Date(result)
}

/**
 * The instant a challenge with `endDate` is fully over for BOTH buddies: the LATER of
 * "00:00 on (endDate + 1 day)" in each buddy's timezone. Neither's final day is cut short.
 */
export function challengeCompletionInstant(
  endDate: string, tzCreator: string | null, tzBuddy: string | null,
): Date {
  const dayAfter = addDays(endDate, 1)
  const a = zonedMidnightUtc(dayAfter, tzCreator).getTime()
  const b = zonedMidnightUtc(dayAfter, tzBuddy).getTime()
  return new Date(Math.max(a, b))
}

/** True once `now` is at/past the challenge's completion instant (self-healing). */
export function isChallengeOver(
  now: Date, endDate: string, tzCreator: string | null, tzBuddy: string | null,
): boolean {
  return now.getTime() >= challengeCompletionInstant(endDate, tzCreator, tzBuddy).getTime()
}
