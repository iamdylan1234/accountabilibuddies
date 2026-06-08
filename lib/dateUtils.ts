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

/**
 * The soonest Monday on or after `fromStr` ("YYYY-MM-DD"). If `fromStr` is
 * already a Monday it's returned unchanged (earliest clean start); otherwise
 * the upcoming Monday. Returns "YYYY-MM-DD". Used to default a new challenge's
 * start to a fresh-week kickoff rather than "today".
 */
export function nextMonday(fromStr: string): string {
  const [y, m, d] = fromStr.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()  // 0=Sun … 6=Sat
  const delta = (1 - dow + 7) % 7             // 0 when already Monday
  return addDays(fromStr, delta)
}

/**
 * All calendar months ("YYYY-MM") that the inclusive range [start, end] touches.
 * Used by GoalSetupForm to render one MonthDatePicker per spanned month so a
 * challenge crossing a month boundary doesn't hide its second month from the
 * frequency-date picker.
 *
 * monthsInRange('2026-09-09', '2026-10-08') === ['2026-09', '2026-10']
 * monthsInRange('2026-05-01', '2026-05-31') === ['2026-05']
 */
export function monthsInRange(startStr: string, endStr: string): string[] {
  const [sy, sm] = startStr.split('-').map(Number)
  const [ey, em] = endStr.split('-').map(Number)
  const months: string[] = []
  let y = sy, m = sm
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    if (++m > 12) { m = 1; y++ }
  }
  return months
}
