import type { Goal, CheckIn } from '@/types/database'
import { scoreChallenge } from '@/lib/scoring'
import { addDays, daysBetween } from '@/lib/dateUtils'

/**
 * Percentage-point delta between the user's score over the LAST 7 days and the
 * PRIOR 7 days. Positive = trending up; negative = down. Returns `null` if
 * fewer than 14 days have elapsed since `startDate` — comparing to <7 days of
 * prior data is too noisy to be useful. Reuses the existing `scoreChallenge`
 * algorithm with explicit 7-day windows. Used by HeroScore.
 */
export function weeklyTrend(
  goals: Goal[],
  checkIns: CheckIn[],
  startDate: string,
  today: string,
): number | null {
  if (daysBetween(startDate, today) < 14) return null

  const last7Start  = addDays(today, -6)
  const prior7End   = addDays(today, -7)
  const prior7Start = addDays(today, -13)

  const inWindow = (lo: string, hi: string) =>
    checkIns.filter(c => c.date >= lo && c.date <= hi)

  const last7  = scoreChallenge(goals, inWindow(last7Start,  today),     7, last7Start,  today,     true)
  const prior7 = scoreChallenge(goals, inWindow(prior7Start, prior7End), 7, prior7Start, prior7End, true)

  return Math.round(last7 - prior7)
}

/**
 * Outcome of one calendar week within the challenge — used by WeeklyScorecard
 * to render the per-week comparison + trophy.
 *
 * - `winner: 'pending'` while the week is in progress (today is between `from`
 *   and `to`). Trophy is suppressed in that state.
 * - `winner: 'tie'` if both scored the same on a complete week.
 */
export interface WeekResult {
  weekNum: number       // 1-indexed
  label: string         // "May 1–3" / "Apr 28 – May 3"
  from: string          // YYYY-MM-DD (challenge-bounded)
  to: string            // YYYY-MM-DD (challenge-bounded)
  myScore: number       // 0..100
  buddyScore: number    // 0..100
  inProgress: boolean   // true if today is within [from, to]
  winner: 'me' | 'buddy' | 'tie' | 'pending'
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/** "May 1–3" if same month, "Apr 28 – May 3" if cross-month, "May 1" if 1 day. */
function formatRange(from: string, to: string): string {
  const [, fmStr, fdStr] = from.split('-')
  const [, tmStr, tdStr] = to.split('-')
  const fm = Number(fmStr), fd = Number(fdStr)
  const tm = Number(tmStr), td = Number(tdStr)
  if (from === to) return `${MONTH_SHORT[fm - 1]} ${fd}`
  if (fm === tm) return `${MONTH_SHORT[fm - 1]} ${fd}–${td}`
  return `${MONTH_SHORT[fm - 1]} ${fd} – ${MONTH_SHORT[tm - 1]} ${td}`
}

/** Day-of-week 1..7 where Monday=1 ... Sunday=7. */
function dowMonStart(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return dow === 0 ? 7 : dow
}

/**
 * Per-week comparison data for the WeeklyScorecard. Each entry covers one
 * calendar week (Mon–Sun) intersected with the challenge window. For
 * in-progress weeks (today is within the range), the score window is clamped
 * to `today` so scores reflect "performance so far" not "zero-filled future."
 * For completed weeks, a winner is declared by score; for in-progress, the
 * winner is `'pending'` so the UI can suppress the trophy.
 */
export function weeklyResults(
  myGoals: Goal[],
  myCheckIns: CheckIn[],
  buddyGoals: Goal[],
  buddyCheckIns: CheckIn[],
  startDate: string,
  endDate: string,
  today: string,
): WeekResult[] {
  const results: WeekResult[] = []
  let cursor = startDate
  let weekNum = 1

  while (cursor <= endDate) {
    const dow = dowMonStart(cursor)
    const daysToSunday = 7 - dow
    const calendarSunday = addDays(cursor, daysToSunday)
    const weekEnd = calendarSunday > endDate ? endDate : calendarSunday

    const inProgress = today >= cursor && today <= weekEnd
    // For in-progress weeks, score only through `today` (don't zero-fill future days).
    const scoreEnd = inProgress ? today : weekEnd
    const daysInScoreWindow = daysBetween(cursor, scoreEnd) + 1

    const myWindow    = myCheckIns.filter(c    => c.date >= cursor && c.date <= scoreEnd)
    const buddyWindow = buddyCheckIns.filter(c => c.date >= cursor && c.date <= scoreEnd)

    const myScore    = Math.round(scoreChallenge(myGoals,    myWindow,    daysInScoreWindow, cursor, scoreEnd, true))
    const buddyScore = Math.round(scoreChallenge(buddyGoals, buddyWindow, daysInScoreWindow, cursor, scoreEnd, true))

    let winner: WeekResult['winner']
    if (inProgress) winner = 'pending'
    else if (myScore > buddyScore) winner = 'me'
    else if (buddyScore > myScore) winner = 'buddy'
    else winner = 'tie'

    results.push({
      weekNum,
      label: formatRange(cursor, weekEnd),
      from: cursor,
      to: weekEnd,
      myScore,
      buddyScore,
      inProgress,
      winner,
    })

    cursor = addDays(weekEnd, 1)
    weekNum++
  }

  return results
}
