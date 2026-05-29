import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import MissedGoalCard from './MissedGoalCard'
import type { Goal } from '@/types/database'

const goal: Goal = {
  id: 'g1', challenge_id: 'c1', user_id: 'u1', title: 'Gym',
  type: 'frequency', target_count: 3, target_unit: null,
  created_at: '', schedule_dates: ['2026-05-20'], catch_up: true,
}

describe('MissedGoalCard', () => {
  it('locked state shows ONLY "log today first" — not the "to catch up" pill', () => {
    // Locked = today is also a scheduled day. Showing both pills overflowed the
    // narrow tile, so the locked state collapses to the single actionable hint.
    render(<MissedGoalCard goal={goal} missedDays={5} isMyGoal={true} onOpen={() => {}} isLocked={true} />)
    expect(screen.getByText(/log today first/i)).toBeInTheDocument()
    expect(screen.queryByText(/to catch up/i)).not.toBeInTheDocument()
  })

  it('unlocked pending state shows the "to catch up" pill (and no hint)', () => {
    render(<MissedGoalCard goal={goal} missedDays={5} isMyGoal={true} onOpen={() => {}} isLocked={false} />)
    expect(screen.getByText(/5 to catch up/i)).toBeInTheDocument()
    expect(screen.queryByText(/log today first/i)).not.toBeInTheDocument()
  })

  it('caught-up state shows a caught-up pill', () => {
    render(<MissedGoalCard goal={goal} missedDays={0} isMyGoal={true} onOpen={() => {}} caughtUpToday={2} />)
    expect(screen.getByText(/caught up today/i)).toBeInTheDocument()
  })
})
