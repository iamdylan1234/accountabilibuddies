'use client'

import { useState, useTransition } from 'react'
import { updateGoal } from '@/app/wrap-up/actions'
import type { Goal } from '@/types/database'

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 0]

interface Props { goal: Goal }

export default function GoalEditButton({ goal }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(goal.title)
  const [scheduleDays, setScheduleDays] = useState<number[]>(goal.schedule_days ?? [])
  const [catchUp, setCatchUp] = useState(goal.catch_up)
  const [saving, setSaving] = useState(false)
  const [, startTransition] = useTransition()

  function toggleDay(val: number) {
    setScheduleDays(prev => {
      const next = prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val]
      if (next.length === 0 || next.length === 7) setCatchUp(false)
      return next
    })
  }

  function isDaySelected(val: number) {
    return scheduleDays.length === 0 || scheduleDays.includes(val)
  }

  function handleSave() {
    setSaving(true)
    startTransition(async () => {
      await updateGoal(goal.id, {
        title,
        schedule_days: scheduleDays.length > 0 && scheduleDays.length < 7 ? scheduleDays : null,
        catch_up: catchUp,
      })
      setSaving(false)
      setOpen(false)
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-gray-300 hover:text-teal-500 transition text-sm leading-none"
        aria-label="Edit goal"
      >
        ✏️
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-black text-gray-900">Edit Goal</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >×</button>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">
                Target days
              </label>
              <div className="flex gap-1">
                {DAY_LABELS.map((label, idx) => {
                  const val = DAY_VALUES[idx]
                  const selected = isDaySelected(val)
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleDay(val)}
                      className={`w-9 h-9 rounded-full text-xs font-bold transition ${
                        selected ? 'text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                      style={selected ? { background: 'linear-gradient(135deg, #00C9A7, #0077B6)' } : {}}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {scheduleDays.length > 0 && scheduleDays.length < 7 && (
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={catchUp}
                  onChange={e => setCatchUp(e.target.checked)}
                  className="rounded"
                />
                Show as catch-up goal if I miss a day
              </label>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
