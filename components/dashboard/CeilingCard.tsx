'use client'

import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react'
import { logValue, deleteCheckIn } from '@/app/dashboard/checkin-actions'
import type { Goal, CheckIn } from '@/types/database'
import CeilingLogSheet from './CeilingLogSheet'

interface Props {
  goal: Goal
  checkIns: CheckIn[]   // all check-ins for this goal across the challenge
  today: string
  isMyGoal: boolean
  // Pace context (Today tab). Optional: the read-only Week-tab tile omits these
  // (pace is a "today" concept) and the card then flags only over-budget, not
  // over-pace.
  dayNumber?: number    // 1-indexed day into the challenge
  totalDays?: number
}

/**
 * Today-tab card for a ceiling (capped) goal — log increments, stay UNDER the
 * cap to win. Deliberately NOT styled like the celebratory teal "done" tiles:
 * a ceiling tracks something you're trying to limit, so the palette is calm
 * slate, shifting to amber near the cap and red once over. The score is NOT
 * shown here (it lives in the scorecard/wrap-up) — surfacing a falling % on
 * every log makes honest logging feel punishing, which is how you get people
 * to stop logging. The card shows pace + remaining budget instead.
 *
 * Logging:
 *  - "+1" is one tap for the common single-increment case, with an Undo toast
 *    (a mis-tap shouldn't be permanent — there's no decrement otherwise).
 *  - "Log" opens a sheet for custom amounts and per-entry removal (correct an
 *    older mistake from earlier today).
 */
export default function CeilingCard({ goal, checkIns, today, isMyGoal, dayNumber, totalDays }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [, startTransition] = useTransition()
  const [undo, setUndo] = useState<{ id: string } | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [optimisticCheckIns, applyOptimistic] = useOptimistic(
    checkIns,
    (state: CheckIn[], action: { type: 'add'; entry: CheckIn } | { type: 'remove'; id: string }) =>
      action.type === 'add'
        ? [...state, action.entry]
        : state.filter(c => c.id !== action.id),
  )

  const target = goal.target_count ?? 0
  const unit = goal.target_unit ?? ''

  const totalUsed = optimisticCheckIns
    .filter(c => c.goal_id === goal.id && c.value != null)
    .reduce((sum, c) => sum + (c.value ?? 0), 0)

  const todayEntries = optimisticCheckIns
    .filter(c => c.goal_id === goal.id && c.date === today && c.value != null)

  const remaining = target - totalUsed
  const over = target > 0 && totalUsed >= target
  const usedPct = target > 0 ? Math.min(1, totalUsed / target) : 0

  // Pace: how much budget "should" be spent by now if consumed evenly. Only
  // computed when pace context is supplied (Today tab); the Week-tab tile omits
  // it, so overPace is simply false there.
  const expectedByNow = dayNumber != null && totalDays
    ? target * (dayNumber / Math.max(1, totalDays))
    : Infinity
  const overPace = !over && totalUsed > expectedByNow

  // Neutral palette — slate when safe, amber as it fills / off pace, red over.
  const barColor = over ? '#ef4444' : usedPct >= 0.7 || overPace ? '#f59e0b' : '#64748b'

  const paceLabel = over ? 'Over budget' : overPace ? 'Over pace' : 'On pace'
  const paceClass = over
    ? 'bg-red-100 text-red-700'
    : overPace
    ? 'bg-amber-100 text-amber-700'
    : 'bg-slate-100 text-slate-600'

  // Clean number display (avoid 0.30000000004 from float sums)
  const fmt = (n: number) => parseFloat(n.toFixed(2))

  useEffect(() => {
    return () => { if (undoTimer.current) clearTimeout(undoTimer.current) }
  }, [])

  function armUndoDismiss() {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setUndo(null), 5000)
  }

  function handleQuickLog() {
    startTransition(async () => {
      applyOptimistic({ type: 'add', entry: {
        id: `optimistic-${Date.now()}`, goal_id: goal.id, user_id: '',
        date: today, completed: true, value: 1, created_at: '',
      } })
      const res = await logValue(goal.id, today, 1)
      if ('id' in res) {
        setUndo({ id: res.id })
        armUndoDismiss()
      }
    })
  }

  function handleUndo() {
    if (!undo) return
    const id = undo.id
    setUndo(null)
    if (undoTimer.current) clearTimeout(undoTimer.current)
    startTransition(async () => {
      applyOptimistic({ type: 'remove', id })
      await deleteCheckIn(id)
    })
  }

  function handleSheetSave(value: number) {
    startTransition(async () => {
      applyOptimistic({ type: 'add', entry: {
        id: `optimistic-${Date.now()}`, goal_id: goal.id, user_id: '',
        date: today, completed: true, value, created_at: '',
      } })
      await logValue(goal.id, today, value)
    })
  }

  function handleSheetRemove(id: string) {
    startTransition(async () => {
      applyOptimistic({ type: 'remove', id })
      await deleteCheckIn(id)
    })
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <p className="flex-1 text-sm font-semibold text-gray-800">{goal.title}</p>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${paceClass}`}>
            {paceLabel}
          </span>
        </div>

        {/* Budget bar — fills as the cap is consumed (slate→amber→red). */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${Math.round(usedPct * 100)}%`, background: barColor }} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {over
              ? <span className="text-red-600 font-bold">{fmt(-remaining)}{unit ? ` ${unit}` : ''} over</span>
              : <><span className="font-bold text-gray-700">{fmt(remaining)}{unit ? ` ${unit}` : ''}</span> left</>}
            <span className="text-gray-400"> · {fmt(totalUsed)}/{target}{unit ? ` ${unit}` : ''}</span>
          </span>
          {isMyGoal && (
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleQuickLog}
                className="text-xs font-bold text-slate-600 hover:text-slate-800 transition">
                +1
              </button>
              <button type="button" onClick={() => setSheetOpen(true)}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 transition">
                Log
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Undo toast — fixed bottom, dismisses after 5s or on tap. */}
      {undo && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold rounded-full px-4 py-2.5 shadow-lg flex items-center gap-3">
          <span>Logged +1</span>
          <button type="button" onClick={handleUndo} className="text-amber-300 font-bold">Undo</button>
        </div>
      )}

      {sheetOpen && isMyGoal && (
        <CeilingLogSheet
          goal={goal}
          totalUsed={totalUsed}
          target={target}
          unit={unit}
          todayEntries={todayEntries}
          onSave={handleSheetSave}
          onRemove={handleSheetRemove}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  )
}
