'use client'

import { useState, useTransition } from 'react'
import { submitGoalChangeRequest } from '@/app/wrap-up/actions'
import type { Goal, GoalType } from '@/types/database'
import MonthDatePicker from '@/components/goals/MonthDatePicker'

interface Props {
  goal: Goal
  challengeId: string
  challengeStartDate: string
  challengeEndDate: string
  myId: string
}

export default function GoalEditButton({ goal, challengeId, challengeStartDate, challengeEndDate, myId }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(goal.title)
  const [type, setType] = useState<GoalType>(goal.type)
  const [targetCount, setTargetCount] = useState(goal.target_count?.toString() ?? '')
  const [targetUnit, setTargetUnit] = useState(goal.target_unit ?? '')
  const [scheduleDates, setScheduleDates] = useState<string[]>(goal.schedule_dates ?? [])
  const [catchUp, setCatchUp] = useState(goal.catch_up)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [, startTransition] = useTransition()

  const isMyGoal = goal.user_id === myId
  const challengeMonth = challengeStartDate.slice(0, 7)

  function handleSave() {
    setSaving(true)
    setSaveError('')
    startTransition(async () => {
      const result = await submitGoalChangeRequest(goal.id, challengeId, {
        title,
        type,
        target_count: (type === 'frequency' || type === 'cumulative') ? (parseInt(targetCount) || null) : null,
        target_unit: targetUnit.trim() || null,
        schedule_dates: scheduleDates.length > 0 ? scheduleDates : null,
        catch_up: catchUp,
      })
      setSaving(false)
      if (result?.error) {
        setSaveError(result.error)
      } else {
        setSubmitted(true)
        setTimeout(() => { setOpen(false); setSubmitted(false) }, 1500)
      }
    })
  }

  if (!isMyGoal) return null  // buddies can't edit each other's goals

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="text-gray-300 hover:text-teal-500 transition text-sm leading-none"
        aria-label="Request goal edit">✏️</button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4"
          onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-gray-900">Request Goal Change</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 text-xl leading-none">×</button>
            </div>

            <p className="text-xs text-gray-400 bg-yellow-50 border border-yellow-200 rounded-lg p-2">
              Your buddy must approve this change before it takes effect.
            </p>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">Type</label>
              <div className="flex gap-2 flex-wrap">
                {(['daily', 'milestone', 'frequency', 'cumulative'] as GoalType[]).map(t => (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition ${type === t ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                    style={type === t ? { background: 'linear-gradient(135deg, #00C9A7, #0077B6)' } : {}}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {type === 'frequency' && (
              <div className="space-y-3">
                <input type="number" value={targetCount}
                  onChange={e => { setTargetCount(e.target.value); setScheduleDates([]) }}
                  placeholder="How many times?" min="1" max="31"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                {parseInt(targetCount) > 0 && (
                  <MonthDatePicker
                    month={challengeMonth} startDate={challengeStartDate} endDate={challengeEndDate}
                    selectedDates={scheduleDates} maxDates={parseInt(targetCount)}
                    onChange={setScheduleDates} />
                )}
                {scheduleDates.length > 0 && scheduleDates.length < parseInt(targetCount) && (
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={catchUp} onChange={e => setCatchUp(e.target.checked)} className="rounded" />
                    Show as catch-up if I miss a date
                  </label>
                )}
              </div>
            )}

            {type === 'cumulative' && (
              <div className="space-y-2">
                <input type="number" value={targetCount} onChange={e => setTargetCount(e.target.value)}
                  placeholder="Target total (e.g. 100)" min="1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                <input type="text" value={targetUnit} onChange={e => setTargetUnit(e.target.value)}
                  placeholder="Unit (e.g. km, pages)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
            )}

            {saveError && (
              <p className="text-red-500 text-xs bg-red-50 border border-red-200 rounded-lg p-2">{saveError}</p>
            )}

            {submitted
              ? <p className="text-center text-teal-600 font-bold text-sm">✓ Request sent to buddy!</p>
              : <button onClick={handleSave} disabled={saving}
                  className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}>
                  {saving ? 'Sending…' : 'Request change'}
                </button>
            }
          </div>
        </div>
      )}
    </>
  )
}
