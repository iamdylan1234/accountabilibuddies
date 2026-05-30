import { dailyCompletionPct, intensityLevel, weeklyTrend } from '../heatmap'
import type { Goal, CheckIn } from '@/types/database'

// Tiny factory to keep tests readable. Most fields are irrelevant to the
// helpers under test — `as Goal` casts cover the unused ones.
const goal = (id: string, type: Goal['type'], extra: Partial<Goal> = {}): Goal =>
  ({ id, type, ...extra } as Goal)
const checkIn = (goal_id: string, date: string, completed = true): CheckIn =>
  ({ goal_id, date, completed, user_id: 'u', id: `${goal_id}-${date}`, created_at: '', value: null } as CheckIn)

describe('dailyCompletionPct', () => {
  it('returns null on a rest day (no day-scheduled goals)', () => {
    const goals = [goal('g1', 'cumulative'), goal('g2', 'milestone')]
    expect(dailyCompletionPct(goals, [], '2026-06-01')).toBeNull()
  })
  it('0 when scheduled goals exist but none done', () => {
    expect(dailyCompletionPct([goal('g1', 'daily')], [], '2026-06-01')).toBe(0)
  })
  it('1 when all scheduled goals done', () => {
    expect(dailyCompletionPct([goal('g1', 'daily')], [checkIn('g1', '2026-06-01')], '2026-06-01')).toBe(1)
  })
  it('0.5 when half done', () => {
    const goals = [goal('g1', 'daily'), goal('g2', 'daily')]
    expect(dailyCompletionPct(goals, [checkIn('g1', '2026-06-01')], '2026-06-01')).toBe(0.5)
  })
  it('frequency goals only count on their schedule_dates', () => {
    const goals = [
      goal('g1', 'frequency', { schedule_dates: ['2026-06-01', '2026-06-03'] }),
      goal('g2', 'frequency', { schedule_dates: ['2026-06-02'] }),
    ]
    expect(dailyCompletionPct(goals, [checkIn('g1', '2026-06-01')], '2026-06-01')).toBe(1)
  })
  it('ignores incomplete check-ins', () => {
    expect(dailyCompletionPct(
      [goal('g1', 'daily')],
      [checkIn('g1', '2026-06-01', false)],
      '2026-06-01',
    )).toBe(0)
  })
})

describe('intensityLevel', () => {
  it('rest day (null) → -1', () => { expect(intensityLevel(null)).toBe(-1) })
  it('0 → 0', () => { expect(intensityLevel(0)).toBe(0) })
  it('just above 0 → 1', () => { expect(intensityLevel(0.01)).toBe(1) })
  it('0.25 → 1', () => { expect(intensityLevel(0.25)).toBe(1) })
  it('0.50 → 2', () => { expect(intensityLevel(0.50)).toBe(2) })
  it('0.75 → 3', () => { expect(intensityLevel(0.75)).toBe(3) })
  it('1.0 → 4', () => { expect(intensityLevel(1.0)).toBe(4) })
})

describe('weeklyTrend', () => {
  it('null when fewer than 14 days have elapsed', () => {
    const goals = [goal('g1', 'daily')]
    // Day 13 since 2026-05-01 = 2026-05-14: still < 14 days elapsed
    expect(weeklyTrend(goals, [], '2026-05-01', '2026-05-14')).toBeNull()
  })
  it('positive delta when last week beat the prior week', () => {
    const goals = [goal('g1', 'daily')]
    // Prior 7 days (2026-05-15..21): 1 check-in → low score
    // Last 7 days (2026-05-22..28): 7 check-ins → high score
    const checkIns = [
      checkIn('g1', '2026-05-15'),
      ...['22','23','24','25','26','27','28'].map(d => checkIn('g1', `2026-05-${d}`)),
    ]
    const trend = weeklyTrend(goals, checkIns, '2026-05-01', '2026-05-28')
    expect(trend).not.toBeNull()
    expect(trend!).toBeGreaterThan(0)
  })
  it('negative delta when last week was worse than the prior week', () => {
    const goals = [goal('g1', 'daily')]
    const checkIns = ['15','16','17','18','19','20','21'].map(d => checkIn('g1', `2026-05-${d}`))
    const trend = weeklyTrend(goals, checkIns, '2026-05-01', '2026-05-28')
    expect(trend).not.toBeNull()
    expect(trend!).toBeLessThan(0)
  })
})
