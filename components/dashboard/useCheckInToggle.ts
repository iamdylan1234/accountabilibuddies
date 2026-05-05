import { useOptimistic, useTransition, useState } from 'react'
import { toggleCheckIn } from '@/app/dashboard/checkin-actions'
import type { CheckIn } from '@/types/database'

/**
 * Manages optimistic check-in state for the current user's goals.
 *
 * Returns:
 * - `optimisticCheckIns` — the check-in list with pending toggles applied
 * - `failedGoals`        — set of goalIds whose last toggle failed (shown in error state for 3 s)
 * - `handleToggle`       — call with a goalId to optimistically toggle today's check-in
 */
export function useCheckInToggle(myCheckIns: CheckIn[], myId: string, today: string) {
  const [, startTransition] = useTransition()
  const [failedGoals, setFailedGoals] = useState<Set<string>>(new Set())

  const [optimisticCheckIns, applyOptimistic] = useOptimistic(
    myCheckIns,
    (state: CheckIn[], { goalId, action }: { goalId: string; action: 'add' | 'remove' }) => {
      if (action === 'remove') {
        return state.filter(c => !(c.goal_id === goalId && c.date === today))
      }
      return [...state, {
        id: `optimistic-${goalId}`,
        goal_id: goalId,
        user_id: myId,
        date: today,
        completed: true,
        value: null,
        created_at: '',
      }]
    }
  )

  function handleToggle(goalId: string) {
    const existing = optimisticCheckIns.find(c => c.goal_id === goalId && c.date === today)
    startTransition(async () => {
      applyOptimistic({ goalId, action: existing ? 'remove' : 'add' })
      const result = await toggleCheckIn(goalId, today)
      if (result?.error) {
        // Roll back the optimistic update and briefly mark the goal as failed
        applyOptimistic({ goalId, action: existing ? 'add' : 'remove' })
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
