'use client'

import { BRAND_GRADIENT } from '@/lib/brand'

interface Props {
  /** "YYYY-MM" — which month to render */
  month: string
  /** First selectable date "YYYY-MM-DD" */
  startDate: string
  /** Last selectable date "YYYY-MM-DD" */
  endDate: string
  selectedDates: string[]
  /** When set, prevents selecting more than this many dates */
  maxDates?: number
  onChange: (dates: string[]) => void
}

export default function MonthDatePicker({ month, startDate, endDate, selectedDates, maxDates, onChange }: Props) {
  const [year, monthNum] = month.split('-').map(Number)
  const daysInMonth = new Date(year, monthNum, 0).getDate()
  const firstDow = (new Date(year, monthNum - 1, 1).getDay() + 6) % 7 // Mon=0

  const atMax = maxDates !== undefined && selectedDates.length >= maxDates

  function toggle(date: string) {
    if (date < startDate || date > endDate) return
    const selected = selectedDates.includes(date)
    if (!selected && atMax) return
    onChange(selected ? selectedDates.filter(d => d !== date) : [...selectedDates, date])
  }

  const monthLabel = new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div>
      {/* Month header only — selection counter lives once, above the whole
          picker group (lifted out of here so a 2-month challenge doesn't
          render two redundant "8/10 selected" counters that read like a
          per-month requirement). */}
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{monthLabel}</p>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <span key={i} className="text-xs font-bold text-gray-300 pb-1">{d}</span>
        ))}
        {Array.from({ length: firstDow }, (_, i) => <span key={`pad-${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const date = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const selected = selectedDates.includes(date)
          const inRange = date >= startDate && date <= endDate
          // Distinguish two "disabled" states so they don't look identical:
          //   outOfWindow: date isn't part of this challenge (faintest)
          //   lockedByCap: date is in-window but target already met (visibly
          //     muted but still readable — hints "tap a selected date to swap")
          const outOfWindow = !inRange
          const lockedByCap = inRange && !selected && atMax
          const disabled = outOfWindow || lockedByCap
          return (
            <button
              key={date}
              type="button"
              onClick={() => toggle(date)}
              disabled={disabled}
              className={`w-8 h-8 rounded-full text-xs font-bold mx-auto flex items-center justify-center transition ${
                selected ? 'text-white' :
                outOfWindow ? 'text-gray-200 cursor-not-allowed' :
                lockedByCap ? 'text-gray-400 bg-gray-50 cursor-not-allowed' :
                'text-gray-600 hover:bg-gray-100'
              }`}
              style={selected ? { background: BRAND_GRADIENT } : {}}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
