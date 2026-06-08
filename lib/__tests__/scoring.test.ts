import {
  scoreGoal, scoreChallenge, getWeekStart,
  isGoalActiveToday, isGoalCatchUp, getCurrentStreak,
  getBestStreak, getMissedDays, dayCompletionStatus,
  getWeeklyStatChip,
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

// Check-in carrying a logged value (cumulative / ceiling goals).
const civ = (date: string, value: number, goalId = 'g1'): CheckIn => ({
  id: `${date}-${value}`, goal_id: goalId, user_id: 'u1', date, completed: true, value, created_at: '',
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

  describe('ceiling', () => {
    it('0 logged = full credit (1.0)', () => {
      expect(scoreGoal(baseGoal('ceiling', 40), [], 30)).toBe(1)
    })
    it('linear decay below the cap', () => {
      // 12 of 40 → 1 - 12/40 = 0.7
      expect(scoreGoal(baseGoal('ceiling', 40), [civ('2026-06-10', 12)], 30)).toBeCloseTo(0.7)
    })
    it('sums multiple logs', () => {
      // 5 + 7 = 12 of 40 → 0.7
      expect(scoreGoal(baseGoal('ceiling', 40), [civ('2026-06-10', 5), civ('2026-06-11', 7)], 30)).toBeCloseTo(0.7)
    })
    it('at the cap = 0', () => {
      expect(scoreGoal(baseGoal('ceiling', 40), [civ('2026-06-10', 40)], 30)).toBe(0)
    })
    it('over the cap clamps to 0 (never negative)', () => {
      expect(scoreGoal(baseGoal('ceiling', 40), [civ('2026-06-10', 47)], 30)).toBe(0)
    })
    it('no cap set = full credit (nothing to exceed)', () => {
      expect(scoreGoal(baseGoal('ceiling', null), [civ('2026-06-10', 5)], 30)).toBe(1)
    })
    it('ignores value-less check-ins', () => {
      // a bare completed check-in (value null) contributes 0 to the consumed total
      expect(scoreGoal(baseGoal('ceiling', 40), [ci('2026-06-10')], 30)).toBe(1)
    })
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

  it('excludes cumulative but INCLUDES ceiling', () => {
    // One done milestone (1.0) + one cumulative (would be 0.5) + one ceiling
    // (12/40 → 0.7). Cumulative is excluded from the denominator; ceiling is not.
    // Expected = average of [milestone 1.0, ceiling 0.7] = 0.85 → 85%.
    const goals: Goal[] = [
      baseGoal('milestone'),
      { ...baseGoal('cumulative', 100), id: 'gc' },
      { ...baseGoal('ceiling', 40), id: 'gk' },
    ]
    const checkIns = [
      ci('2026-06-10', 'g1'),          // milestone done
      civ('2026-06-10', 50, 'gc'),     // cumulative 50/100 (ignored in challenge %)
      civ('2026-06-10', 12, 'gk'),     // ceiling 12/40 → 0.7
    ]
    expect(scoreChallenge(goals, checkIns, 30)).toBe(85)
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

  it('daily: endOffset=2 excludes yesterday from the count', () => {
    // Today May 7, challenge May 1, no check-ins. With endOffset=2, we count May 1–5 (5 days).
    expect(getMissedDays(daily(), [], '2026-05-07', '2026-05-01', 7, 2)).toBe(5)
  })

  it('daily: endOffset=1 (default) includes yesterday', () => {
    // Same scenario; default endOffset=1 means we count May 1–6 (6 days).
    expect(getMissedDays(daily(), [], '2026-05-07', '2026-05-01')).toBe(6)
  })

  it('frequency: endOffset=2 excludes yesterday scheduled date', () => {
    // dates: May 5 (day-before-yesterday) and May 6 (yesterday). Both missed.
    // With endOffset=2, only May 5 counts → 1.
    const goal = freq(['2026-05-05', '2026-05-06'])
    expect(getMissedDays(goal, [], '2026-05-07', '2026-05-01', 7, 2)).toBe(1)
  })
})

describe('dayCompletionStatus', () => {
  const dailyGoal: Goal = {
    id: 'g1', challenge_id: 'c1', user_id: 'u1', title: 'Wake up',
    type: 'daily', target_count: null, target_unit: null,
    created_at: '', schedule_dates: null, catch_up: false,
  }
  const freqGoal: Goal = {
    id: 'g2', challenge_id: 'c1', user_id: 'u1', title: 'Gym',
    type: 'frequency', target_count: 3, target_unit: null,
    created_at: '', schedule_dates: ['2026-05-12', '2026-05-14', '2026-05-16'], catch_up: false,
  }
  const goals = [dailyGoal, freqGoal]
  const start = '2026-05-12'
  const end = '2026-06-10'
  const today = '2026-05-15'

  it('returns "out-of-range" for days before challenge start', () => {
    expect(dayCompletionStatus(goals, '2026-05-10', [], today, start, end)).toBe('out-of-range')
  })

  it('returns "out-of-range" for days after challenge end', () => {
    expect(dayCompletionStatus(goals, '2026-06-15', [], today, start, end)).toBe('out-of-range')
  })

  it('returns "future" for days after today with scheduled goals', () => {
    expect(dayCompletionStatus(goals, '2026-05-16', [], today, start, end)).toBe('future')
  })

  it('returns "rest" for days with no scheduled goals (past)', () => {
    // 2026-05-13 (Wed): no frequency scheduled, but daily is always scheduled
    // → daily counts, not a rest day. Use a goal set with ONLY frequency.
    expect(dayCompletionStatus([freqGoal], '2026-05-13', [], today, start, end)).toBe('rest')
  })

  it('returns "rest" for future days with no scheduled goals', () => {
    expect(dayCompletionStatus([freqGoal], '2026-05-17', [], today, start, end)).toBe('rest')
  })

  it('returns "empty" when scheduled goals exist but none completed', () => {
    expect(dayCompletionStatus(goals, '2026-05-14', [], today, start, end)).toBe('empty')
  })

  it('treats today as a past/present day (not future) for an unchecked day', () => {
    expect(dayCompletionStatus(goals, today, [], today, start, end)).toBe('empty')
  })

  it('returns "partial" when some but not all scheduled goals completed', () => {
    const checkIns: CheckIn[] = [
      { id: 'c1', goal_id: 'g1', user_id: 'u1', date: '2026-05-14', completed: true, value: null, created_at: '' },
    ]
    // Daily checked, frequency (g2) scheduled-not-completed → partial
    expect(dayCompletionStatus(goals, '2026-05-14', checkIns, today, start, end)).toBe('partial')
  })

  it('returns "full" when all scheduled goals completed', () => {
    const checkIns: CheckIn[] = [
      { id: 'c1', goal_id: 'g1', user_id: 'u1', date: '2026-05-14', completed: true, value: null, created_at: '' },
      { id: 'c2', goal_id: 'g2', user_id: 'u1', date: '2026-05-14', completed: true, value: null, created_at: '' },
    ]
    expect(dayCompletionStatus(goals, '2026-05-14', checkIns, today, start, end)).toBe('full')
  })

  it('ignores cumulative and milestone goals when computing status', () => {
    const milestoneGoal: Goal = { ...dailyGoal, id: 'g3', type: 'milestone' }
    const cumGoal: Goal = { ...dailyGoal, id: 'g4', type: 'cumulative', target_count: 10 }
    const checkIns: CheckIn[] = [
      { id: 'c1', goal_id: 'g1', user_id: 'u1', date: '2026-05-14', completed: true, value: null, created_at: '' },
    ]
    // Only the daily counts. Daily completed → full.
    expect(dayCompletionStatus([dailyGoal, milestoneGoal, cumGoal], '2026-05-14', checkIns, today, start, end)).toBe('full')
  })
})

describe('getWeeklyStatChip', () => {
  const dailyGoal: Goal = {
    id: 'g1', challenge_id: 'c1', user_id: 'u1', title: 'Wake up',
    type: 'daily', target_count: null, target_unit: null,
    created_at: '', schedule_dates: null, catch_up: false,
  }
  const freqGoal: Goal = {
    id: 'g2', challenge_id: 'c1', user_id: 'u1', title: 'Gym',
    type: 'frequency', target_count: 3, target_unit: null,
    created_at: '', schedule_dates: ['2026-05-12', '2026-05-14', '2026-05-16'], catch_up: false,
  }
  const cumGoalKm: Goal = {
    id: 'g3', challenge_id: 'c1', user_id: 'u1', title: 'Run',
    type: 'cumulative', target_count: 100, target_unit: 'km',
    created_at: '', schedule_dates: null, catch_up: false,
  }
  const cumGoalNoUnit: Goal = { ...cumGoalKm, id: 'g4', target_unit: null }
  const milestoneGoal: Goal = {
    id: 'g5', challenge_id: 'c1', user_id: 'u1', title: 'Race',
    type: 'milestone', target_count: null, target_unit: null,
    created_at: '', schedule_dates: null, catch_up: false,
  }

  const weekStart = '2026-05-12'  // Monday
  const weekEnd = '2026-05-18'    // Sunday

  it('returns null for daily goals (always 7/elapsed, uninteresting)', () => {
    expect(getWeeklyStatChip(dailyGoal, weekStart, weekEnd, [])).toBeNull()
  })

  it('returns null for milestone goals (binary state visible in tile)', () => {
    expect(getWeeklyStatChip(milestoneGoal, weekStart, weekEnd, [])).toBeNull()
  })

  it('frequency: "0/3 wk" when no completions', () => {
    expect(getWeeklyStatChip(freqGoal, weekStart, weekEnd, [])).toBe('0/3 wk')
  })

  it('frequency: counts completed scheduled days in week', () => {
    const checkIns: CheckIn[] = [
      { id: 'c1', goal_id: 'g2', user_id: 'u1', date: '2026-05-12', completed: true, value: null, created_at: '' },
      { id: 'c2', goal_id: 'g2', user_id: 'u1', date: '2026-05-14', completed: true, value: null, created_at: '' },
    ]
    expect(getWeeklyStatChip(freqGoal, weekStart, weekEnd, checkIns)).toBe('2/3 wk')
  })

  it('frequency: only counts check-ins on SCHEDULED days', () => {
    // Wed (5/13) and Sun (5/18) not scheduled — these should not count
    const checkIns: CheckIn[] = [
      { id: 'c1', goal_id: 'g2', user_id: 'u1', date: '2026-05-13', completed: true, value: null, created_at: '' },
      { id: 'c2', goal_id: 'g2', user_id: 'u1', date: '2026-05-18', completed: true, value: null, created_at: '' },
    ]
    expect(getWeeklyStatChip(freqGoal, weekStart, weekEnd, checkIns)).toBe('0/3 wk')
  })

  it('frequency: returns null when schedule_dates is null', () => {
    const noScheduleFreq: Goal = {
      ...freqGoal,
      id: 'g99',
      schedule_dates: null,
    }
    expect(getWeeklyStatChip(noScheduleFreq, weekStart, weekEnd, [])).toBeNull()
  })

  it('cumulative with unit: "+42 km wk"', () => {
    const checkIns: CheckIn[] = [
      { id: 'c1', goal_id: 'g3', user_id: 'u1', date: '2026-05-12', completed: false, value: 12, created_at: '' },
      { id: 'c2', goal_id: 'g3', user_id: 'u1', date: '2026-05-14', completed: false, value: 30, created_at: '' },
    ]
    expect(getWeeklyStatChip(cumGoalKm, weekStart, weekEnd, checkIns)).toBe('+42 km wk')
  })

  it('cumulative with no unit: "+42 wk"', () => {
    const checkIns: CheckIn[] = [
      { id: 'c1', goal_id: 'g4', user_id: 'u1', date: '2026-05-12', completed: false, value: 42, created_at: '' },
    ]
    expect(getWeeklyStatChip(cumGoalNoUnit, weekStart, weekEnd, checkIns)).toBe('+42 wk')
  })

  it('cumulative: ignores values outside the week window', () => {
    const checkIns: CheckIn[] = [
      { id: 'c1', goal_id: 'g3', user_id: 'u1', date: '2026-05-10', completed: false, value: 100, created_at: '' },
      { id: 'c2', goal_id: 'g3', user_id: 'u1', date: '2026-05-12', completed: false, value: 5, created_at: '' },
    ]
    expect(getWeeklyStatChip(cumGoalKm, weekStart, weekEnd, checkIns)).toBe('+5 km wk')
  })

  it('cumulative: rounds floating-point noise to 2-decimal precision', () => {
    const checkIns: CheckIn[] = [
      { id: 'c1', goal_id: 'g3', user_id: 'u1', date: '2026-05-12', completed: false, value: 0.1, created_at: '' },
      { id: 'c2', goal_id: 'g3', user_id: 'u1', date: '2026-05-14', completed: false, value: 0.2, created_at: '' },
    ]
    expect(getWeeklyStatChip(cumGoalKm, weekStart, weekEnd, checkIns)).toBe('+0.3 km wk')
  })

  it('cumulative: returns null when total is 0', () => {
    expect(getWeeklyStatChip(cumGoalKm, weekStart, weekEnd, [])).toBeNull()
  })
})
