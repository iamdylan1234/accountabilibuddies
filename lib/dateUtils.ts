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
