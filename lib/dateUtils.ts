/**
 * Date formatting utilities — shared across scoring, WeekView, GoalCalendarSheet.
 * All functions return ISO 8601 date strings (YYYY-MM-DD) in local time.
 */

/**
 * Format a Date object as "YYYY-MM-DD" using local time components.
 * Timezone-safe alternative to date.toISOString().slice(0, 10).
 */
export function formatDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * Format year + zero-based month + day as "YYYY-MM-DD".
 * Used where calendar cells are built from numeric parts
 * (month is 0-based, matching the JS Date convention).
 */
export function formatYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Add a number of days to a YYYY-MM-DD string and return the new YYYY-MM-DD.
 * Uses local-time Date construction to avoid timezone shifts at midnight.
 */
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return formatDate(dt)
}

/**
 * Whole calendar days from `fromStr` to `toStr` (both "YYYY-MM-DD"), local time.
 * Positive when `toStr` is later, negative when earlier, 0 for the same day.
 * Built from local midnights and rounded, so a 23/25-hour DST day never drifts
 * the result. daysBetween('2026-05-29','2026-06-01') === 3.
 */
export function daysBetween(fromStr: string, toStr: string): number {
  const [fy, fm, fd] = fromStr.split('-').map(Number)
  const [ty, tm, td] = toStr.split('-').map(Number)
  const from = new Date(fy, fm - 1, fd).getTime()
  const to = new Date(ty, tm - 1, td).getTime()
  return Math.round((to - from) / 86400000)
}
