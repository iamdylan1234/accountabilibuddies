import type { Goal, CheckIn } from '@/types/database'
import { scoreChallenge } from '@/lib/scoring'
import { addDays, daysBetween } from '@/lib/dateUtils'

/**
 * Returns the fraction (0..1) of day-scheduled goals the user completed on
 * `date`. Day-scheduled = `daily` goals (always due) OR `frequency` goals whose
 * `schedule_dates` includes `date`. Cumulative + milestone goals are excluded —
 * they don't have a day-level "due" notion. Returns `null` if there are no
 * scheduled goals on that day (rest day).
 */
export function dailyCompletionPct(
  goals: Goal[],
  checkIns: CheckIn[],
  date: string,
): number | null {
  const dueGoals = goals.filter(g =>
    g.type === 'daily' ||
    (g.type === 'frequency' && (g.schedule_dates ?? []).includes(date))
  )
  if (dueGoals.length === 0) return null

  const done = dueGoals.filter(g =>
    checkIns.some(c => c.goal_id === g.id && c.date === date && c.completed)
  ).length

  return done / dueGoals.length
}

/**
 * Maps a daily-completion fraction to a discrete intensity level for the
 * heat-map color scale.
 *   -1: rest day (no scheduled goals)
 *    0: 0%
 *    1: 1–25%
 *    2: 26–50%
 *    3: 51–75%
 *    4: 76–100%
 */
export function intensityLevel(pct: number | null): -1 | 0 | 1 | 2 | 3 | 4 {
  if (pct === null) return -1
  if (pct === 0) return 0
  if (pct <= 0.25) return 1
  if (pct <= 0.50) return 2
  if (pct <= 0.75) return 3
  return 4
}

/**
 * Percentage-point delta between the user's score over the LAST 7 days and the
 * PRIOR 7 days. Positive = trending up; negative = down. Returns `null` if
 * fewer than 14 days have elapsed since `startDate` — comparing to <7 days of
 * prior data is too noisy to be useful. Reuses the existing `scoreChallenge`
 * algorithm with explicit 7-day windows.
 */
export function weeklyTrend(
  goals: Goal[],
  checkIns: CheckIn[],
  startDate: string,
  today: string,
): number | null {
  // Need at least 14 days of history (current 7 + prior 7).
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
