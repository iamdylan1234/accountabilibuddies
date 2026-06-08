'use client'

import { useEffect, useState } from 'react'
import type { Goal, CheckIn } from '@/types/database'

interface Props {
  goal: Goal
  totalUsed: number
  target: number
  unit: string
  todayEntries: CheckIn[]   // today's value-bearing check-ins, for the remove list
  onSave: (value: number) => void
  onRemove: (checkInId: string) => void
  onClose: () => void
}

/**
 * Slide-up sheet for a ceiling goal: log a custom amount, AND correct mistakes
 * by removing any of today's individual entries. The remove list is the
 * deliberate "edit path" — real-time tap logging guarantees the occasional
 * mis-count, and a ceiling that can only ever go up would feel broken and push
 * people to stop logging honestly. Mirrors CumulativeLogSheet's shell; the
 * neutral (non-teal) palette signals this is a limit, not an achievement.
 */
export default function CeilingLogSheet({
  goal, totalUsed, target, unit, todayEntries, onSave, onRemove, onClose,
}: Props) {
  const [inputVal, setInputVal] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  function handleClose() {
    setMounted(false)
    setTimeout(onClose, 280)
  }

  function handleSubmit() {
    const v = parseFloat(inputVal)
    if (isNaN(v) || v <= 0) return
    onSave(v)
    setInputVal('')
  }

  const fmt = (n: number) => parseFloat(n.toFixed(2))
  const remaining = target - totalUsed
  const over = target > 0 && totalUsed >= target

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-xl transition-transform duration-300 ${mounted ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="p-6 pb-8 space-y-5 max-w-lg mx-auto">
          <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto -mt-2" />

          {/* Title + budget state */}
          <div>
            <h2 className="text-lg font-bold text-gray-800">{goal.title}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {fmt(totalUsed)}{unit ? ` ${unit}` : ''} of {target}{unit ? ` ${unit}` : ''} used ·{' '}
              {over
                ? <span className="text-red-600 font-bold">{fmt(-remaining)} over</span>
                : <span className="font-semibold text-gray-700">{fmt(remaining)} left</span>}
            </p>
          </div>

          {/* Number input + log */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Log {unit || 'amount'}
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder={unit ? `Enter ${unit}` : 'Enter amount'}
                min="0.01"
                step="any"
                autoFocus
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-lg text-center focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!inputVal || parseFloat(inputVal) <= 0}
                className="px-6 rounded-xl text-sm font-bold text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-40 transition"
              >
                Log
              </button>
            </div>
          </div>

          {/* Today's entries with remove (the correction path) */}
          {todayEntries.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Logged today
              </p>
              <div className="flex flex-wrap gap-2">
                {todayEntries.map(entry => (
                  <span key={entry.id}
                    className="inline-flex items-center gap-1.5 bg-gray-100 rounded-full pl-3 pr-2 py-1 text-sm text-gray-700">
                    {fmt(entry.value ?? 0)}{unit ? ` ${unit}` : ''}
                    <button
                      type="button"
                      onClick={() => onRemove(entry.id)}
                      aria-label="Remove this entry"
                      className="w-4 h-4 rounded-full bg-gray-300 text-white text-xs leading-none flex items-center justify-center hover:bg-red-400 transition"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleClose}
            className="w-full py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition"
          >
            Done
          </button>
        </div>
      </div>
    </>
  )
}
