import {
  scoreGoal, scoreChallenge, getWeekStart,
  isGoalActiveToday, isGoalCatchUp, getCurrentStreak,
  getBestStreak, getMissedDays,
} from '../scoring'
import type { Goal, CheckIn } from '@/types/database'
import type { GoalStreakContext } from '../scoring'

const baseGoal = (type: Goal['type'], target_count: number | null = null): Goal => ({
  id: 'g1', challenge_id: 'c1', user_id: 'u1',
  title: 'Test', type, target_count, created_at: '',
  target_unit: null, schedule_dates: null, catch_up: false,
})

const ci = (date: string, goalId = 'g1'): CheckIn => ({
  id: date, goal_id: goalId, user_id: 'u1', date, completed: true, value: null, created_at: '',
})

describe('scoreGoal', () => {
  it('daily: completions / totalDays', () => {
    expect(scoreGoal(baseGoal('daily'), [ci('2026-05-01'), ci('2026-05-02')], 10))
      .toBeCloseTo(0.2)
  })

  it('daily: uses elapsed days when startDate+today provided', () => {
    // 5 days elapsed (May 1–5), 2 completions → 2/5 = 0.4
    expect(scoreGoal(baseGoal('daily'), [ci('2026-05-01'), ci('2026-05-03')], 30, '2026-05-01', '2026-05-05'))
      .toBeCloseTo(0.4)
  })

  it('milestone: 1 if done, 0 if not', () => {
    expect(scoreGoal(baseGoal('milestone'), [ci('2026-05-01')], 30)).toBe(1)
    expect(scoreGoal(baseGoal('milestone'), [], 30)).toBe(0)
  })

  it('frequency without dates: completions / target_count', () => {
    expect(scoreGoal(baseGoal('frequency', 10), Array.from({length: 7}, (_, i) => ci(`2026-05-0${i+1}`)), 30))
      .toBeCloseTo(0.7)
  })

  it('frequency with schedule_dates: completions / past dates', () => {
    const goal: Goal = { ...baseGoal('frequency', 4), schedule_dates: ['2026-05-01','2026-05-05','2026-05-10','2026-05-15'] }
    // today = May 6, past dates = [May 1, May 5] = 2. 1 completion → 0.5
    expect(scoreGoal(goal, [ci('2026-05-01')], 30, '2026-05-01', '2026-05-06')).toBeCloseTo(0.5)
  })

  it('caps at 1', () => {
    expect(scoreGoal(baseGoal('frequency', 3), [ci('2026-05-01'), ci('2026-05-02'), ci('2026-05-03'), ci('2026-05-04')], 30)).toBe(1)
  })
})

describe('scoreChallenge', () => {
  it('average of goal scores as percentage', () => {
    const goals: Goal[] = [baseGoal('milestone'), { ...baseGoal('milestone'), id: 'g2' }]
    expect(scoreChallenge(goals, [ci('2026-05-01')], 30)).toBe(50)
  })

  it('returns 0 for empty goals', () => {
    expect(scoreChallenge([], [], 30)).toBe(0)
  })
})

describe('getWeekStart', () => {
  it('returns Monday given a Monday', () => {
    expect(getWeekStart(new Date(2026, 3, 27))).toEqual(new Date(2026, 3, 27))
  })

  it('returns previous Monday given a Wednesday', () => {
    expect(getWeekStart(new Date(2026, 3, 29))).toEqual(new Date(2026, 3, 27))
  })

  it('returns previous Monday given a Sunday', () => {
    expect(getWeekStart(new Date(2026, 4, 3))).toEqual(new Date(2026, 3, 27))
  })
})

describe('isGoalActiveToday', () => {
  it('daily (no dates): always true', () => {
    expect(isGoalActiveToday(baseGoal('daily'), '2026-05-05', [])).toBe(true)
  })

  it('frequency: true when today is a scheduled date', () => {
    const goal: Goal = { ...baseGoal('frequency'), schedule_dates: ['2026-05-05', '2026-05-12'] }
    expect(isGoalActiveToday(goal, '2026-05-05', [])).toBe(true)
  })

  it('frequency: false when today is not scheduled and catch_up=false', () => {
    const goal: Goal = { ...baseGoal('frequency'), schedule_dates: ['2026-05-03', '2026-05-10'], catch_up: false }
    expect(isGoalActiveToday(goal, '2026-05-06', [])).toBe(false)
  })

  it('frequency: true when catch_up=true and behind', () => {
    const goal: Goal = { ...baseGoal('frequency'), schedule_dates: ['2026-05-03', '2026-05-10'], catch_up: true }
    // May 3 has passed, no completions → behind
    expect(isGoalActiveToday(goal, '2026-05-06', [])).toBe(true)
  })

  it('frequency: false when catch_up=true but not behind', () => {
    const goal: Goal = { ...baseGoal('frequency'), schedule_dates: ['2026-05-03', '2026-05-10'], catch_up: true }
    expect(isGoalActiveToday(goal, '2026-05-06', [ci('2026-05-03')])).toBe(false)
  })
})

describe('isGoalCatchUp', () => {
  it('false when no schedule', () => {
    expect(isGoalCatchUp({ ...baseGoal('daily'), catch_up: true }, '2026-05-06', [])).toBe(false)
  })

  it('false when today IS a scheduled date', () => {
    const goal: Goal = { ...baseGoal('frequency'), schedule_dates: ['2026-05-06'], catch_up: true }
    expect(isGoalCatchUp(goal, '2026-05-06', [])).toBe(false)
  })

  it('true when a past scheduled date was missed', () => {
    const goal: Goal = { ...baseGoal('frequency'), schedule_dates: ['2026-05-03', '2026-05-10'], catch_up: true }
    expect(isGoalCatchUp(goal, '2026-05-06', [])).toBe(true)
  })

  it('false when caught up', () => {
    const goal: Goal = { ...baseGoal('frequency'), schedule_dates: ['2026-05-03', '2026-05-10'], catch_up: true }
    expect(isGoalCatchUp(goal, '2026-05-06', [ci('2026-05-03')])).toBe(false)
  })
})

describe('getCurrentStreak', () => {
  it('returns 0 with no check-ins', () => {
    expect(getCurrentStreak(baseGoal('daily'), [], '2026-05-05')).toBe(0)
  })

  it('counts consecutive calendar days for daily goal', () => {
    const checkIns = [ci('2026-05-03'), ci('2026-05-04'), ci('2026-05-05')]
    expect(getCurrentStreak(baseGoal('daily'), checkIns, '2026-05-05')).toBe(3)
  })

  it('breaks on a missed calendar day', () => {
    // May 03 missing
    expect(getCurrentStreak(baseGoal('daily'), [ci('2026-05-04'), ci('2026-05-05')], '2026-05-05')).toBe(2)
  })

  it('counts consecutive schedule_dates for frequency goal', () => {
    const goal: Goal = { ...baseGoal('frequency'), schedule_dates: ['2026-05-01','2026-05-05','2026-05-10'] }
    // today = May 07 → past dates = [May 1, May 5]. Both done → streak 2
    expect(getCurrentStreak(goal, [ci('2026-05-01'), ci('2026-05-05')], '2026-05-07')).toBe(2)
  })

  it('breaks on a missed schedule_date', () => {
    const goal: Goal = { ...baseGoal('frequency'), schedule_dates: ['2026-05-01','2026-05-05','2026-05-10'] }
    // May 01 missed, May 05 done → streak 1
    expect(getCurrentStreak(goal, [ci('2026-05-05')], '2026-05-07')).toBe(1)
  })
})

describe('scoreGoal — cumulative', () => {
  it('sums check-in values against target_count', () => {
    const goal: Goal = { ...baseGoal('cumulative', 100), target_unit: 'km' }
    const checkIns: CheckIn[] = [
      { id: '1', goal_id: 'g1', user_id: 'u1', date: '2026-05-01', completed: true, value: 7.5, created_at: '' },
      { id: '2', goal_id: 'g1', user_id: 'u1', date: '2026-05-03', completed: true, value: 12.0, created_at: '' },
    ]
    expect(scoreGoal(goal, checkIns, 30)).toBeCloseTo(0.195) // 19.5/100
  })

  it('caps at 1 when over target', () => {
    const goal: Goal = { ...baseGoal('cumulative', 10), target_unit: 'km' }
    const checkIns: CheckIn[] = [
      { id: '1', goal_id: 'g1', user_id: 'u1', date: '2026-05-01', completed: true, value: 15, created_at: '' },
    ]
    expect(scoreGoal(goal, checkIns, 30)).toBe(1)
  })

  it('returns 0 when no target_count set', () => {
    const goal: Goal = { ...baseGoal('cumulative', null), target_unit: 'km' }
    expect(scoreGoal(goal, [], 30)).toBe(0)
  })

  it('scoreChallenge excludes cumulative goals from overall %', () => {
    const goals: Goal[] = [
      baseGoal('milestone'),                              // 0%
      { ...baseGoal('cumulative', 100), id: 'g2', target_unit: 'km' }, // excluded
    ]
    // Only milestone scored → 0/1 = 0%
    expect(scoreChallenge(goals, [], 30)).toBe(0)
  })
})

// ─── getBestStreak helpers ────────────────────────────────────────────────────

const makeGoal = (overrides: {
  id?: string
  type: Goal['type']
  title?: string
  target_count?: number | null
  schedule_dates?: string[] | null
}): Goal => ({
  id: overrides.id ?? 'g1',
  challenge_id: 'c1',
  user_id: 'u1',
  title: overrides.title ?? 'Test Goal',
  type: overrides.type,
  target_count: overrides.target_count ?? null,
  target_unit: null,
  schedule_dates: overrides.schedule_dates ?? null,
  catch_up: false,
  created_at: '',
})

const makeCheckIn = (overrides: {
  goal_id: string
  date: string
  completed?: boolean
}): CheckIn => ({
  id: overrides.date + '-' + overrides.goal_id,
  goal_id: overrides.goal_id,
  user_id: 'u1',
  date: overrides.date,
  completed: overrides.completed ?? true,
  value: null,
  created_at: '',
})

// ─── getBestStreak ────────────────────────────────────────────────────────────

describe('getBestStreak', () => {
  const ctx = (goal: Goal, challengeName = 'Jan Challenge', buddyName = 'Alex'): GoalStreakContext => ({
    goal, challengeName, buddyName,
  })

  it('returns null when no check-ins exist', () => {
    const goal = makeGoal({ type: 'daily' })
    expect(getBestStreak([ctx(goal)], [])).toBeNull()
  })

  it('returns a single-day streak for one check-in', () => {
    const goal = makeGoal({ id: 'g1', type: 'daily' })
    const result = getBestStreak([ctx(goal)], [makeCheckIn({ goal_id: 'g1', date: '2026-01-01' })])
    expect(result).not.toBeNull()
    expect(result!.days).toBe(1)
    expect(result!.startDate).toBe('2026-01-01')
    expect(result!.endDate).toBe('2026-01-01')
  })

  it('finds a consecutive calendar-day streak for a daily goal', () => {
    const goal = makeGoal({ id: 'g1', type: 'daily' })
    const checkIns = [
      makeCheckIn({ goal_id: 'g1', date: '2026-01-01' }),
      makeCheckIn({ goal_id: 'g1', date: '2026-01-02' }),
      makeCheckIn({ goal_id: 'g1', date: '2026-01-03' }),
      // gap
      makeCheckIn({ goal_id: 'g1', date: '2026-01-05' }),
    ]
    const result = getBestStreak([ctx(goal)], checkIns)
    expect(result!.days).toBe(3)
    expect(result!.startDate).toBe('2026-01-01')
    expect(result!.endDate).toBe('2026-01-03')
  })

  it('finds best streak across multiple goals, picks highest', () => {
    const g1 = makeGoal({ id: 'g1', type: 'daily' })
    const g2 = makeGoal({ id: 'g2', type: 'daily' })
    const checkIns = [
      makeCheckIn({ goal_id: 'g1', date: '2026-01-01' }),
      makeCheckIn({ goal_id: 'g1', date: '2026-01-02' }),
      makeCheckIn({ goal_id: 'g2', date: '2026-02-01' }),
      makeCheckIn({ goal_id: 'g2', date: '2026-02-02' }),
      makeCheckIn({ goal_id: 'g2', date: '2026-02-03' }),
      makeCheckIn({ goal_id: 'g2', date: '2026-02-04' }),
    ]
    const result = getBestStreak([ctx(g1, 'Jan', 'Alex'), ctx(g2, 'Feb', 'Alex')], checkIns)
    expect(result!.days).toBe(4)
    expect(result!.goalTitle).toBe('Test Goal')
    expect(result!.challengeName).toBe('Feb')
  })

  it('counts consecutive schedule_dates for a frequency goal (not calendar days)', () => {
    // schedule: every Monday/Wednesday/Friday
    const goal = makeGoal({
      id: 'g1',
      type: 'frequency',
      target_count: 3,
      schedule_dates: ['2026-01-05', '2026-01-07', '2026-01-09', '2026-01-12', '2026-01-14'],
    })
    // Completed first 3 scheduled dates = streak of 3
    const checkIns = [
      makeCheckIn({ goal_id: 'g1', date: '2026-01-05' }),
      makeCheckIn({ goal_id: 'g1', date: '2026-01-07' }),
      makeCheckIn({ goal_id: 'g1', date: '2026-01-09' }),
      // missed Jan 12
      makeCheckIn({ goal_id: 'g1', date: '2026-01-14' }),
    ]
    const result = getBestStreak([ctx(goal)], checkIns)
    expect(result!.days).toBe(3)
    expect(result!.startDate).toBe('2026-01-05')
    expect(result!.endDate).toBe('2026-01-09')
  })

  it('attaches correct goal title, challenge name, buddy name', () => {
    const goal = makeGoal({ id: 'g1', type: 'daily', title: 'Attend BJJ' })
    const checkIns = [makeCheckIn({ goal_id: 'g1', date: '2026-03-01' })]
    const result = getBestStreak([ctx(goal, 'Mar Challenge', 'Alex')], checkIns)
    expect(result!.goalTitle).toBe('Attend BJJ')
    expect(result!.challengeName).toBe('Mar Challenge')
    expect(result!.buddyName).toBe('Alex')
  })
})

describe('getMissedDays', () => {
  // Helper: goal with no schedule_dates (daily)
  const daily = () => baseGoal('daily')

  // Helper: frequency goal with specific dates
  const freq = (dates: string[]): Goal => ({
    ...baseGoal('frequency'),
    schedule_dates: dates,
  })

  it('returns 0 for cumulative goals', () => {
    expect(getMissedDays(baseGoal('cumulative'), [], '2026-05-07', '2026-05-01')).toBe(0)
  })

  it('returns 0 for milestone goals', () => {
    expect(getMissedDays(baseGoal('milestone'), [], '2026-05-07', '2026-05-01')).toBe(0)
  })

  it('returns 0 when challenge started today', () => {
    expect(getMissedDays(daily(), [], '2026-05-07', '2026-05-07')).toBe(0)
  })

  it('daily: counts days before today with no check-in', () => {
    // challenge started May 1, today May 5, no check-ins → 4 missed days (May 1–4)
    expect(getMissedDays(daily(), [], '2026-05-05', '2026-05-01')).toBe(4)
  })

  it('daily: does not count today', () => {
    // today is not missed — it is still open
    expect(getMissedDays(daily(), [ci('2026-05-01'), ci('2026-05-02'), ci('2026-05-03'), ci('2026-05-04')], '2026-05-05', '2026-05-01')).toBe(0)
  })

  it('daily: partially done reduces count', () => {
    // challenge May 1, today May 5 — May 2 done, so 3 missed (May 1, 3, 4)
    expect(getMissedDays(daily(), [ci('2026-05-02')], '2026-05-05', '2026-05-01')).toBe(3)
  })

  it('daily: caps lookback at 7 days', () => {
    // challenge started Apr 1, today May 7 — only looks back to Apr 30 (7 days)
    // Apr 30 – May 6 = 7 days, all missed → 7
    expect(getMissedDays(daily(), [], '2026-05-07', '2026-04-01')).toBe(7)
  })

  it('daily: challengeStart exactly at lookback boundary is included', () => {
    // challengeStart = today - 7 = Apr 30, today = May 7
    // window is [Apr 30, May 6], Apr 30 has no check-in → 7 missed
    expect(getMissedDays(daily(), [], '2026-05-07', '2026-04-30')).toBe(7)
  })

  it('frequency: counts missed schedule_dates in window', () => {
    // dates: May 1, May 3, May 6 — today May 7, window May 1–6
    // May 1 done, May 3 missed, May 6 missed → 2
    const goal = freq(['2026-05-01', '2026-05-03', '2026-05-06', '2026-05-10'])
    expect(getMissedDays(goal, [ci('2026-05-01')], '2026-05-07', '2026-05-01')).toBe(2)
  })

  it('frequency: returns 0 when all past scheduled dates done', () => {
    const goal = freq(['2026-05-01', '2026-05-03'])
    expect(getMissedDays(goal, [ci('2026-05-01'), ci('2026-05-03')], '2026-05-07', '2026-05-01')).toBe(0)
  })

  it('frequency: ignores future schedule_dates', () => {
    const goal = freq(['2026-05-10', '2026-05-15'])
    expect(getMissedDays(goal, [], '2026-05-07', '2026-05-01')).toBe(0)
  })

  it('frequency: no schedule_dates returns 0', () => {
    expect(getMissedDays(baseGoal('frequency'), [], '2026-05-07', '2026-05-01')).toBe(0)
  })
})
