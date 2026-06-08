import { daysBetween, nextMonday, monthsInRange, filterDatesInRange } from '../dateUtils'

describe('daysBetween', () => {
  it('counts whole days forward', () => {
    expect(daysBetween('2026-05-29', '2026-06-01')).toBe(3)
  })
  it('is zero for the same day', () => {
    expect(daysBetween('2026-06-01', '2026-06-01')).toBe(0)
  })
  it('is negative when the target is in the past', () => {
    expect(daysBetween('2026-06-01', '2026-05-30')).toBe(-2)
  })
  it('crosses a month boundary', () => {
    expect(daysBetween('2026-05-31', '2026-06-02')).toBe(2)
  })
  it('crosses a spring-forward DST boundary without drift', () => {
    // US DST begins 2026-03-08 (a 23-hour local day); still exactly 2 days.
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
  })
})

describe('nextMonday', () => {
  it('returns the same day when already a Monday', () => {
    expect(nextMonday('2026-06-01')).toBe('2026-06-01') // Mon
  })
  it('Friday → the upcoming Monday', () => {
    expect(nextMonday('2026-05-29')).toBe('2026-06-01') // Fri (today) → Mon Jun 1
  })
  it('Saturday → the upcoming Monday', () => {
    expect(nextMonday('2026-05-30')).toBe('2026-06-01') // Sat
  })
  it('Sunday → the next-day Monday', () => {
    expect(nextMonday('2026-05-31')).toBe('2026-06-01') // Sun
  })
  it('Tuesday → Monday of the next week', () => {
    expect(nextMonday('2026-06-02')).toBe('2026-06-08') // Tue → +6
  })
})

describe('monthsInRange', () => {
  it('single-month range returns one month', () => {
    expect(monthsInRange('2026-05-01', '2026-05-31')).toEqual(['2026-05'])
  })
  it('single day returns one month', () => {
    expect(monthsInRange('2026-09-09', '2026-09-09')).toEqual(['2026-09'])
  })
  it('two-month span returns both', () => {
    expect(monthsInRange('2026-09-09', '2026-10-08')).toEqual(['2026-09', '2026-10'])
  })
  it('three-month span returns all three', () => {
    expect(monthsInRange('2026-04-15', '2026-06-10')).toEqual(['2026-04', '2026-05', '2026-06'])
  })
  it('crosses year boundary', () => {
    expect(monthsInRange('2026-12-15', '2027-01-14')).toEqual(['2026-12', '2027-01'])
  })
  it('crosses multi-year boundary', () => {
    expect(monthsInRange('2026-11-01', '2027-02-28')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  })
})

describe('filterDatesInRange', () => {
  it('keeps dates inside the window', () => {
    expect(filterDatesInRange(['2026-06-15', '2026-06-20'], '2026-06-09', '2026-07-08'))
      .toEqual(['2026-06-15', '2026-06-20'])
  })
  it('drops dates before the start', () => {
    expect(filterDatesInRange(['2026-05-15', '2026-06-15'], '2026-06-09', '2026-07-08'))
      .toEqual(['2026-06-15'])
  })
  it('drops dates after the end', () => {
    expect(filterDatesInRange(['2026-06-15', '2026-07-20'], '2026-06-09', '2026-07-08'))
      .toEqual(['2026-06-15'])
  })
  it('keeps the boundary dates (inclusive)', () => {
    expect(filterDatesInRange(['2026-06-09', '2026-07-08'], '2026-06-09', '2026-07-08'))
      .toEqual(['2026-06-09', '2026-07-08'])
  })
  it('returns empty when all dates are outside', () => {
    expect(filterDatesInRange(['2026-05-01', '2026-08-01'], '2026-06-09', '2026-07-08'))
      .toEqual([])
  })
  it('preserves the original order', () => {
    expect(filterDatesInRange(['2026-07-01', '2026-06-15', '2026-06-20'], '2026-06-09', '2026-07-08'))
      .toEqual(['2026-07-01', '2026-06-15', '2026-06-20'])
  })
})
