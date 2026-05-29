import { getMilestoneCheckIn } from '../scoring'
import type { CheckIn } from '@/types/database'

const ci = (date: string, goalId = 'm1', completed = true): CheckIn => ({
  id: `${goalId}-${date}`,
  goal_id: goalId,
  user_id: 'u1',
  date,
  completed,
  value: null,
  created_at: '',
})

describe('getMilestoneCheckIn', () => {
  it('returns the completed check-in regardless of its date', () => {
    const result = getMilestoneCheckIn('m1', [ci('2026-05-09')])
    expect(result?.date).toBe('2026-05-09')
  })

  it('returns the completed check-in even when it is NOT dated today (the bug)', () => {
    // A milestone completed last week must still resolve a check-in so the
    // Today/Week tabs render it as done — they previously used a date===today
    // lookup that returned null here.
    const result = getMilestoneCheckIn('m1', [ci('2026-05-01')])
    expect(result).not.toBeNull()
  })

  it('returns null when the milestone has no check-in', () => {
    expect(getMilestoneCheckIn('m1', [])).toBeNull()
  })

  it('returns null when only other goals have check-ins', () => {
    expect(getMilestoneCheckIn('m1', [ci('2026-05-09', 'other')])).toBeNull()
  })

  it('ignores non-completed check-ins', () => {
    expect(getMilestoneCheckIn('m1', [ci('2026-05-09', 'm1', false)])).toBeNull()
  })
})
