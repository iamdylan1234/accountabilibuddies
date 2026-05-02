'use client'

import { useState, useTransition } from 'react'
import { updateGoal } from '@/app/wrap-up/actions'
import type { Goal, GoalType } from '@/types/database'
import MonthDatePicker from '@/components/goals/MonthDatePicker'

interface Props {
  goal: Goal
  challengeStartDate: string
  challengeEndDate: string
}

export default function GoalEditButton({ goal, challengeStartDate, challengeEndDate }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(goal.title)
  const [type, setType] = useState<GoalType>(goal.type)
  const [targetCount, setTargetCount] = useState(goal.target_count?.toString() ?? '')
  const [targetUnit, setTargetUnit] = useState(goal.target_unit ?? '')
  const [scheduleDates, setScheduleDates] = useState<string[]>(goal.schedule_dates ?? [])
  const [catchUp, setCatchUp] = useState(goal.catch_up)
  const [saving, setSaving] = useState(false)
  const [, startTransition] = useTransition()

  const challengeMonth = challengeStartDate.slice(0, 7)

  function handleSave() {
    setSaving(true)
    startTransition(async () => {
      await updateGoal(goal.id, {
        title,
        type,
        target_count: type === 'frequency' ? (parseInt(targetCount) || null) : null,
        target_unit: targetUnit.trim() || null,
        schedule_dates: scheduleDates.length > 0 ? scheduleDates : null,
        catch_up: catchUp,
      })
      setSaving(false)
      setOpen(false)
    })
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="text-gray-300 hover:text-teal-500 transition text-sm leading-none"
        aria-label="Edit goal">✏️</button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-gray-900">Edit Goal</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">Type</label>
              <div className="flex gap-2 flex-wrap">
                {(['daily', 'milestone', 'frequency'] as GoalType[]).map(t => (
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
                    month={challengeMonth}
                    startDate={challengeStartDate}
                    endDate={challengeEndDate}
                    selectedDates={scheduleDates}
                    maxDates={parseInt(targetCount)}
                    onChange={setScheduleDates}
                  />
                )}
                {scheduleDates.length > 0 && scheduleDates.length < parseInt(targetCount) && (
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={catchUp} onChange={e => setCatchUp(e.target.checked)} className="rounded" />
                    Show as catch-up if I miss a date
                  </label>
                )}
              </div>
            )}

            <button onClick={handleSave} disabled={saving}
              className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
