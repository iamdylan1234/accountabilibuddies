import { addDays } from '@/lib/dateUtils'

/**
 * Date fields for a rematch challenge accepted on `acceptLocalToday` (the
 * accepter's local "YYYY-MM-DD"). Starts the next day, runs 30 days inclusive
 * (start + 29, matching createChallenge), and is named after the start month.
 */
export function rematchDates(acceptLocalToday: string): {
  start_date: string
  end_date: string
  month_name: string
} {
  const start_date = addDays(acceptLocalToday, 1)
  const end_date = addDays(start_date, 29)
  const [y, m] = start_date.split('-').map(Number)
  const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long' })
  return { start_date, end_date, month_name: `${monthName} Challenge` }
}
