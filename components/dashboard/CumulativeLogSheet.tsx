'use client'

import { useEffect, useState } from 'react'
import { BRAND_GRADIENT } from '@/lib/brand'
import type { Goal } from '@/types/database'

interface Props {
  goal: Goal
  totalLogged: number
  target: number
  unit: string
  todayTotal: number
  onSave: (value: number) => void
  onClose: () => void
}

/**
 * Slide-up sheet for logging a cumulative-goal value. Replaces the old
 * inline expand-row UX which overflowed the narrow Optional-section column
 * (Save button spilled outside the tile). Sheet pattern matches
 * GoalCalendarSheet for visual consistency across data-entry flows.
 */
export default function CumulativeLogSheet({
  goal, totalLogged, target, unit, todayTotal, onSave, onClose,
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
    handleClose()
  }

  function addQuick(amount: number) {
    const current = parseFloat(inputVal) || 0
    // Round to 2 decimals so floats like 0.1+0.2 don't surface as 0.3000000004
    setInputVal(String(Math.round((current + amount) * 100) / 100))
  }

  const pct = target > 0 ? Math.min(100, Math.round((totalLogged / target) * 100)) : 0

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />
      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-xl transition-transform duration-300 ${mounted ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="p-6 pb-8 space-y-5 max-w-lg mx-auto">
          {/* Drag handle */}
          <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto -mt-2" />

          {/* Title + progress */}
          <div>
            <h2 className="text-lg font-bold text-gray-800">{goal.title}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {totalLogged}{unit ? ` ${unit}` : ''} / {target}{unit ? ` ${unit}` : ''} · {pct}%
              {todayTotal > 0 && <span className="text-teal-500 ml-2">+{todayTotal} today</span>}
            </p>
          </div>

          {/* Number input */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Log amount
            </label>
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
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg text-center focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>

          {/* Quick-add buttons */}
          <div className="flex gap-2">
            {[1, 5, 10].map(amount => (
              <button
                key={amount}
                type="button"
                onClick={() => addQuick(amount)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-bold text-gray-700 hover:bg-gray-200 transition"
              >
                +{amount}
              </button>
            ))}
          </div>

          {/* Save + Cancel */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!inputVal || parseFloat(inputVal) <= 0}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition"
              style={{ background: BRAND_GRADIENT }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
