import { useOptimistic, useTransition, useState } from 'react'
import { toggleCheckIn } from '@/app/dashboard/checkin-actions'
import type { CheckIn } from '@/types/database'

/**
 * Manages optimistic check-in state for the current user's goals.
 *
 * `handleToggle(goalId, date?)` — date defaults to today, but can be passed
 * (e.g., yesterday) to log a check-in for a different date.
 */
export function useCheckInToggle(myCheckIns: CheckIn[], myId: string, today: string) {
  const [, startTransition] = useTransition()
  const [failedGoals, setFailedGoals] = useState<Set<string>>(new Set())

  const [optimisticCheckIns, applyOptimistic] = useOptimistic(
    myCheckIns,
    (state: CheckIn[], { goalId, date, action }: { goalId: string; date: string; action: 'add' | 'remove' }) => {
      if (action === 'remove') {
        return state.filter(c => !(c.goal_id === goalId && c.date === date))
      }
      return [...state, {
        id: `optimistic-${goalId}-${date}`,
        goal_id: goalId,
        user_id: myId,
        date,
        completed: true,
        value: null,
        created_at: '',
      }]
    }
  )

  function handleToggle(goalId: string, date: string = today) {
    const existing = optimisticCheckIns.find(c => c.goal_id === goalId && c.date === date)
    startTransition(async () => {
      applyOptimistic({ goalId, date, action: existing ? 'remove' : 'add' })
      const result = await toggleCheckIn(goalId, date)
      if (result?.error) {
        applyOptimistic({ goalId, date, action: existing ? 'add' : 'remove' })
        setFailedGoals(prev => new Set([...prev, goalId]))
        setTimeout(() => setFailedGoals(prev => {
          const next = new Set(prev)
          next.delete(goalId)
          return next
        }), 3000)
      }
    })
  }

  return { optimisticCheckIns, failedGoals, handleToggle }
}
