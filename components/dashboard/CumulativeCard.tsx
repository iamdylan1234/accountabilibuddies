'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { logValue } from '@/app/dashboard/checkin-actions'
import type { Goal, CheckIn } from '@/types/database'
import { BRAND_GRADIENT_H } from '@/lib/brand'
import CumulativeLogSheet from './CumulativeLogSheet'

interface Props {
  goal: Goal
  checkIns: CheckIn[]   // all check-ins for this goal across the challenge
  today: string
  isMyGoal: boolean
}

export default function CumulativeCard({ goal, checkIns, today, isMyGoal }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [, startTransition] = useTransition()

  const [optimisticCheckIns, applyOptimistic] = useOptimistic(
    checkIns,
    (state: CheckIn[], newEntry: CheckIn) => [...state, newEntry]
  )

  const totalLogged = optimisticCheckIns
    .filter(c => c.goal_id === goal.id && c.value != null)
    .reduce((sum, c) => sum + (c.value ?? 0), 0)

  const target = goal.target_count ?? 0
  const pct = target > 0 ? Math.min(100, Math.round((totalLogged / target) * 100)) : 0
  const unit = goal.target_unit ?? ''

  const todayTotal = optimisticCheckIns
    .filter(c => c.goal_id === goal.id && c.date === today && c.value != null)
    .reduce((sum, c) => sum + (c.value ?? 0), 0)

  // Sheet calls back with a positive number; we apply the optimistic update
  // and persist the value. Sheet closes itself on success.
  function handleSave(value: number) {
    startTransition(async () => {
      applyOptimistic({
        id: `optimistic-${Date.now()}`,
        goal_id: goal.id,
        user_id: '',
        date: today,
        completed: false,
        value,
        created_at: '',
      })
      await logValue(goal.id, today, value)
    })
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <p className="flex-1 text-sm font-semibold text-gray-800">{goal.title}</p>
          <span className="text-xs font-black" style={{ color: '#0077B6' }}>{pct}%</span>
        </div>

        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: BRAND_GRADIENT_H }} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {totalLogged}{unit ? ` ${unit}` : ''} / {target}{unit ? ` ${unit}` : ''}
            {todayTotal > 0 && <span className="text-teal-500 ml-2">(+{todayTotal} today)</span>}
          </span>
          {isMyGoal && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="text-xs font-bold text-teal-600 hover:text-teal-700 transition"
            >
              + Log
            </button>
          )}
        </div>
      </div>

      {sheetOpen && isMyGoal && (
        <CumulativeLogSheet
          goal={goal}
          totalLogged={totalLogged}
          target={target}
          unit={unit}
          todayTotal={todayTotal}
          onSave={handleSave}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  )
}
