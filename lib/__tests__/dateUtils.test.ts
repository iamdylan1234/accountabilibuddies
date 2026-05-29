import { daysBetween, nextMonday } from '../dateUtils'

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
