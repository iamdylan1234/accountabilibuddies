import { rematchDates } from '../rematch'

describe('rematchDates', () => {
  it('starts the day after acceptance and runs 30 days inclusive', () => {
    const r = rematchDates('2026-06-03')
    expect(r.start_date).toBe('2026-06-04')
    expect(r.end_date).toBe('2026-07-03')   // start + 29
  })
  it('names the challenge after the start month', () => {
    expect(rematchDates('2026-06-03').month_name).toBe('June Challenge')
  })
  it('handles a start that crosses into the next month', () => {
    const r = rematchDates('2026-06-30')      // start 2026-07-01
    expect(r.start_date).toBe('2026-07-01')
    expect(r.end_date).toBe('2026-07-30')
    expect(r.month_name).toBe('July Challenge')
  })
  it('handles year boundary', () => {
    const r = rematchDates('2026-12-31')      // start 2027-01-01
    expect(r.start_date).toBe('2027-01-01')
    expect(r.month_name).toBe('January Challenge')
  })
})
