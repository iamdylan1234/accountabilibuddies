'use client'

import { useState } from 'react'
import type { Goal, GoalType } from '@/types/database'
import MonthDatePicker from './MonthDatePicker'
import { BRAND_GRADIENT } from '@/lib/brand'
import Spinner from '@/components/shared/Spinner'

interface GoalDraft {
  id: string
  title: string
  type: GoalType
  target_count: string
  target_unit: string
  schedule_dates: string[]
  catch_up: boolean
}

const emptyGoal = (): GoalDraft => ({
  id: crypto.randomUUID(),
  title: '',
  type: 'daily',
  target_count: '',
  target_unit: '',
  schedule_dates: [],
  catch_up: false,
})

interface Props {
  challengeId: string
  challengeStartDate: string   // "YYYY-MM-DD"
  challengeEndDate: string     // "YYYY-MM-DD"
  existingGoals: Goal[]
  onSubmit: (goals: GoalDraft[]) => Promise<{ error: string } | undefined>
}

export default function GoalSetupForm({
  challengeId, challengeStartDate, challengeEndDate, existingGoals, onSubmit,
}: Props) {
  const challengeMonth = challengeStartDate.slice(0, 7) // "YYYY-MM"

  const [goals, setGoals] = useState<GoalDraft[]>(
    existingGoals.length > 0
      ? existingGoals.map(g => ({
          id: g.id,
          title: g.title,
          type: g.type,
          target_count: g.target_count?.toString() ?? '',
          target_unit: g.target_unit ?? '',
          schedule_dates: g.schedule_dates ?? [],
          catch_up: g.catch_up,
        }))
      : [emptyGoal()]
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Which goal row currently has its goal-type info panel expanded.
  // -1 = none open. Only one open at a time (tapping another closes the first).
  const [infoOpenFor, setInfoOpenFor] = useState<number>(-1)

  function update(i: number, field: keyof GoalDraft, value: unknown) {
    setGoals(prev => prev.map((g, idx) => idx === i ? { ...g, [field]: value } : g))
    if (error) setError('')
  }

  function addGoal() {
    if (goals.length >= 8) return
    setGoals(prev => [...prev, emptyGoal()])
    if (error) setError('')
  }

  function removeGoal(i: number) {
    if (goals.length <= 1) return
    setGoals(prev => prev.filter((_, idx) => idx !== i))
    if (error) setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const filled = goals.filter(g => g.title.trim())
    if (filled.length < 5) { setError('Add at least 5 goals.'); return }
    // Frequency goals need exactly target_count dates
    for (const g of filled) {
      if (g.type === 'frequency') {
        const needed = parseInt(g.target_count) || 0
        if (needed < 1) { setError(`Set a count for "${g.title}".`); return }
        if (g.schedule_dates.length !== needed) {
          setError(`"${g.title}" needs exactly ${needed} date${needed > 1 ? 's' : ''} selected (${g.schedule_dates.length} chosen).`)
          return
        }
      }
      if (g.type === 'cumulative') {
        if (!(parseInt(g.target_count) > 0)) { setError(`Set a target total for "${g.title}".`); return }
      }
    }
    setSubmitting(true)
    try {
      const result = await onSubmit(filled)
      if (result?.error) {
        setError(result.error)
        setSubmitting(false)
      }
      // On success, the server action redirects — no need to clear submitting state
    } catch (err) {
      // Fallback for unexpected throws (network, framework errors, etc.)
      console.error('[GoalSetupForm] unexpected error:', err)
      setError('Something went wrong. Check your connection and try again.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {goals.map((goal, i) => (
        <div key={goal.id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          {/* Title row */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
            <input
              type="text"
              value={goal.title}
              onChange={e => update(i, 'title', e.target.value)}
              placeholder="Goal name (e.g. Run 5km)"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            {goals.length > 1 && (
              <button type="button" onClick={() => removeGoal(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
            )}
          </div>

          {/* Type row */}
          <div className="flex gap-2 ml-7 flex-wrap items-center">
            {(['daily', 'milestone', 'frequency', 'cumulative'] as GoalType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => update(i, 'type', t)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${goal.type === t ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                style={goal.type === t ? { background: BRAND_GRADIENT } : {}}
              >
                {t}
              </button>
            ))}
            {/* Tap "i" to expand a panel that explains all four goal types.
                Single icon at the end of the row rather than one per chip — keeps
                the chip row from getting cluttered on narrow screens. */}
            <button
              type="button"
              onClick={() => setInfoOpenFor(infoOpenFor === i ? -1 : i)}
              aria-label="What do these goal types mean?"
              className="w-5 h-5 rounded-full text-[10px] font-bold text-gray-400 border border-gray-300 hover:bg-gray-50 transition flex items-center justify-center"
            >
              i
            </button>
          </div>
          {infoOpenFor === i && (
            <div className="ml-7 p-3 bg-blue-50 rounded-lg text-xs text-gray-700 space-y-2 border border-blue-100">
              <p><strong className="text-gray-900">Daily</strong> — Do it every day. One tap to mark done. Good for habits like meditation or no alcohol.</p>
              <p><strong className="text-gray-900">Frequency</strong> — Specific days you choose (e.g. Mon/Wed/Fri). Misses can be caught up by doing it on a non-scheduled day.</p>
              <p><strong className="text-gray-900">Cumulative</strong> — Track a number toward a target. Log amounts as you go. Good for &quot;read 10 books&quot; or &quot;save $500&quot;.</p>
              <p><strong className="text-gray-900">Milestone</strong> — A single one-time achievement during the challenge — e.g. run a 5K, finish a course.</p>
            </div>
          )}

          {/* Frequency: count input then calendar */}
          {goal.type === 'frequency' && (
            <div className="ml-7 space-y-3">
              <input
                type="number"
                value={goal.target_count}
                onChange={e => {
                  update(i, 'target_count', e.target.value)
                  update(i, 'schedule_dates', []) // reset dates when count changes
                }}
                placeholder="How many times this month?"
                min="1"
                max="31"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
              {parseInt(goal.target_count) > 0 && (
                <>
                  <MonthDatePicker
                    month={challengeMonth}
                    startDate={challengeStartDate}
                    endDate={challengeEndDate}
                    selectedDates={goal.schedule_dates}
                    maxDates={parseInt(goal.target_count)}
                    onChange={dates => update(i, 'schedule_dates', dates)}
                  />
                  {goal.schedule_dates.length > 0 && goal.schedule_dates.length < parseInt(goal.target_count) && (
                    <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={goal.catch_up}
                        onChange={e => update(i, 'catch_up', e.target.checked)}
                        className="rounded"
                      />
                      Show as catch-up if I miss a date
                    </label>
                  )}
                </>
              )}
            </div>
          )}

          {/* Cumulative: target total + unit */}
          {goal.type === 'cumulative' && (
            <div className="ml-7 space-y-2">
              <input
                type="number"
                value={goal.target_count}
                onChange={e => update(i, 'target_count', e.target.value)}
                placeholder="Target total (e.g. 100)"
                min="1"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
              <input
                type="text"
                value={goal.target_unit}
                onChange={e => update(i, 'target_unit', e.target.value)}
                placeholder="Unit (e.g. km, pages, hours)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
          )}
        </div>
      ))}

      {goals.length < 8 && (
        <button type="button" onClick={addGoal}
          className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-teal-400 hover:text-teal-500 transition font-semibold">
          + Add goal ({goals.length}/8)
        </button>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit" disabled={submitting}
        className="w-full py-3 rounded-xl font-bold text-white text-sm transition active:scale-95 disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2"
        style={{ background: BRAND_GRADIENT }}
      >
        {submitting ? (<><Spinner /><span>Saving…</span></>) : <span>Save goals & continue →</span>}
      </button>
    </form>
  )
}
