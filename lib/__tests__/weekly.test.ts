import { weeklyTrend, weeklyResults } from '../weekly'
import type { Goal, CheckIn } from '@/types/database'

// Tiny factory to keep tests readable. Most fields are irrelevant to the
// helpers under test — `as Goal` casts cover the unused ones.
const goal = (id: string, type: Goal['type'], extra: Partial<Goal> = {}): Goal =>
  ({ id, type, ...extra } as Goal)
const checkIn = (goal_id: string, date: string, completed = true): CheckIn =>
  ({ goal_id, date, completed, user_id: 'u', id: `${goal_id}-${date}`, created_at: '', value: null } as CheckIn)
const checkInVal = (goal_id: string, date: string, value: number): CheckIn =>
  ({ goal_id, date, completed: true, user_id: 'u', id: `${goal_id}-${date}-${value}`, created_at: '', value } as CheckIn)

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

describe('weeklyResults — calendar week splitting', () => {
  // 2026-05-01 is a Friday. Mon–Sun weeks make Week 1 a 3-day partial (Fri–Sun May 1–3).
  it('Friday start (2026-05-01) yields a 3-day Week 1 then 7-day weeks', () => {
    const r = weeklyResults([], [], [], [], '2026-05-01', '2026-05-30', '2026-04-30')
    expect(r.length).toBe(5)
    expect(r[0].from).toBe('2026-05-01')
    expect(r[0].to).toBe('2026-05-03')
    expect(r[0].label).toBe('May 1–3')
    expect(r[1].from).toBe('2026-05-04')
    expect(r[1].to).toBe('2026-05-10')
    expect(r[1].label).toBe('May 4–10')
    expect(r[4].from).toBe('2026-05-25')
    expect(r[4].to).toBe('2026-05-30')
  })
  // 2026-06-01 is a Monday. Should produce clean 7-day weeks.
  it('Monday start (2026-06-01) yields full 7-day weeks', () => {
    const r = weeklyResults([], [], [], [], '2026-06-01', '2026-06-30', '2026-05-31')
    expect(r[0].from).toBe('2026-06-01')
    expect(r[0].to).toBe('2026-06-07')
    expect(r[0].label).toBe('Jun 1–7')
  })
})

describe('weeklyResults — winner determination', () => {
  it('"me" when my score is higher', () => {
    const goals = [goal('g1', 'daily')]
    // Week May 4–10 (7 days). I complete all 7, buddy completes 3.
    const myCi = ['04','05','06','07','08','09','10'].map(d => checkIn('g1', `2026-05-${d}`))
    const buCi = ['04','05','06'].map(d => checkIn('g1', `2026-05-${d}`))
    const r = weeklyResults(goals, myCi, goals, buCi, '2026-05-04', '2026-05-10', '2026-05-11')
    expect(r[0].winner).toBe('me')
    expect(r[0].myScore).toBeGreaterThan(r[0].buddyScore)
  })
  it('"buddy" when buddy beats me', () => {
    const goals = [goal('g1', 'daily')]
    const myCi = ['04','05','06'].map(d => checkIn('g1', `2026-05-${d}`))
    const buCi = ['04','05','06','07','08','09','10'].map(d => checkIn('g1', `2026-05-${d}`))
    const r = weeklyResults(goals, myCi, goals, buCi, '2026-05-04', '2026-05-10', '2026-05-11')
    expect(r[0].winner).toBe('buddy')
  })
  it('"tie" when equal on a completed week', () => {
    const goals = [goal('g1', 'daily')]
    const ci = ['04','05','06','07'].map(d => checkIn('g1', `2026-05-${d}`))
    const r = weeklyResults(goals, ci, goals, ci, '2026-05-04', '2026-05-10', '2026-05-11')
    expect(r[0].winner).toBe('tie')
    expect(r[0].myScore).toBe(r[0].buddyScore)
  })
})

describe('weeklyResults — in-progress week', () => {
  it('flags the week containing today as in-progress with winner="pending"', () => {
    const goals = [goal('g1', 'daily')]
    // Today is mid-week (May 6, a Wednesday). The week May 4–10 is in progress.
    const r = weeklyResults(goals, [], goals, [], '2026-05-04', '2026-05-31', '2026-05-06')
    expect(r[0].inProgress).toBe(true)
    expect(r[0].winner).toBe('pending')
  })
  it('clamps in-progress scoring to today (does NOT zero-fill future days)', () => {
    const goals = [goal('g1', 'daily')]
    // Today May 6, Mon-Wed (4,5,6). I checked in 3/3 → 100%. If we wrongly
    // scored through May 10 (7 days), I'd be at 3/7 = 43%.
    const myCi = ['04','05','06'].map(d => checkIn('g1', `2026-05-${d}`))
    const r = weeklyResults(goals, myCi, goals, [], '2026-05-04', '2026-05-31', '2026-05-06')
    expect(r[0].myScore).toBe(100)
  })
})

describe('weeklyResults — historical (today past end)', () => {
  it('all weeks complete, no pending winners', () => {
    const goals = [goal('g1', 'daily')]
    const r = weeklyResults(goals, [], goals, [], '2026-05-01', '2026-05-30', '2026-06-15')
    for (const w of r) {
      expect(w.inProgress).toBe(false)
      expect(w.winner).not.toBe('pending')
    }
  })
})

describe('weeklyResults — frequency goal scoring (not target_count)', () => {
  it('scores against scheduled-in-window, NOT total target_count', () => {
    // "Run 5km" has target_count=5 (whole challenge) with one scheduled day in
    // the week. Hitting that one day should be 100% for the week — not 1/5=20%.
    const runGoal = goal('run', 'frequency', { target_count: 5, schedule_dates: ['2026-05-06'] })
    const r = weeklyResults(
      [runGoal], [checkIn('run', '2026-05-06')],
      [runGoal], [],
      '2026-05-04', '2026-05-10', '2026-05-11',
    )
    expect(r[0].myScore).toBe(100)
    expect(r[0].buddyScore).toBe(0)
  })
  it('skips a frequency goal with 0 scheduled days this week (does not drag avg to 0)', () => {
    // Two goals: a daily Dylan hits perfectly, plus a frequency goal with no
    // scheduled days this week. The skip means the week scores 100%, not 50%.
    const dailyG = goal('d1', 'daily')
    const freqG  = goal('f1', 'frequency', { target_count: 5, schedule_dates: ['2026-05-15'] })
    const ci = ['04','05','06','07','08','09','10'].map(d => checkIn('d1', `2026-05-${d}`))
    const r = weeklyResults([dailyG, freqG], ci, [dailyG, freqG], [], '2026-05-04', '2026-05-10', '2026-05-11')
    expect(r[0].myScore).toBe(100)
  })
})

describe('weeklyResults — milestone goals are excluded from weekly average', () => {
  it('an undone milestone does NOT drag the weekly average to 0', () => {
    // Daily perfect + undone milestone → 100%, NOT 50%.
    const dailyG     = goal('d1', 'daily')
    const milestoneG = goal('m1', 'milestone')
    const ci = ['04','05','06','07','08','09','10'].map(d => checkIn('d1', `2026-05-${d}`))
    const r = weeklyResults(
      [dailyG, milestoneG], ci,
      [dailyG, milestoneG], [],
      '2026-05-04', '2026-05-10', '2026-05-11',
    )
    expect(r[0].myScore).toBe(100)
  })
  it('a completed milestone does NOT bump up the weekly average to 100', () => {
    // Daily missed + milestone completed this week → 0%, NOT 50%.
    const dailyG     = goal('d1', 'daily')
    const milestoneG = goal('m1', 'milestone')
    const ci = [checkIn('m1', '2026-05-05')]   // milestone done, no daily
    const r = weeklyResults(
      [dailyG, milestoneG], ci,
      [dailyG, milestoneG], [],
      '2026-05-04', '2026-05-10', '2026-05-11',
    )
    expect(r[0].myScore).toBe(0)
  })
})

describe('weeklyResults — cumulative goals still excluded', () => {
  it('a cumulative goal does not contribute to the weekly average', () => {
    const dailyG      = goal('d1', 'daily')
    const cumulativeG = goal('c1', 'cumulative', { target_count: 100 })
    const ci = ['04','05','06','07','08','09','10'].map(d => checkIn('d1', `2026-05-${d}`))
    const r = weeklyResults(
      [dailyG, cumulativeG], ci,
      [dailyG, cumulativeG], [],
      '2026-05-04', '2026-05-10', '2026-05-11',
    )
    expect(r[0].myScore).toBe(100)
  })
})

describe('weeklyResults — ceiling goals pro-rate the cap by week', () => {
  // 30-day challenge (Jun 1–30, Monday start = clean 7-day weeks), ceiling cap
  // 30 → pro-rated 7 per full week. Today past end so all weeks are complete.
  const ceilingG = goal('k1', 'ceiling', { target_count: 30 })

  it('0 logged in the week = 100%', () => {
    const r = weeklyResults([ceilingG], [], [ceilingG], [], '2026-06-01', '2026-06-30', '2026-07-15')
    expect(r[0].from).toBe('2026-06-01')
    expect(r[0].to).toBe('2026-06-07')
    expect(r[0].myScore).toBe(100)
  })

  it('at the pro-rated cap = 0%', () => {
    // 7 logged in a 7-day window whose pro-rated cap is 7 → 1 - 7/7 = 0.
    const myCi = [checkInVal('k1', '2026-06-03', 7)]
    const r = weeklyResults([ceilingG], myCi, [ceilingG], [], '2026-06-01', '2026-06-30', '2026-07-15')
    expect(r[0].myScore).toBe(0)
  })

  it('a heavy week scores below a clean week (buddy comparison)', () => {
    // Me: 2 logged (1 - 2/7 ≈ 71%). Buddy: 6 logged (1 - 6/7 ≈ 14%). I win the week.
    const myCi = [checkInVal('k1', '2026-06-02', 2)]
    const buCi = [checkInVal('k1', '2026-06-02', 6)]
    const r = weeklyResults([ceilingG], myCi, [ceilingG], buCi, '2026-06-01', '2026-06-30', '2026-07-15')
    expect(r[0].myScore).toBeGreaterThan(r[0].buddyScore)
    expect(r[0].winner).toBe('me')
  })
})
