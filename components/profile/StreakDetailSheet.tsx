'use client'

import { useState, useEffect, useRef } from 'react'
import type { BestStreakResult } from '@/lib/scoring'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface CurrentStreakInfo {
  days: number
  goalTitle: string
}

interface Props {
  best: BestStreakResult
  current: CurrentStreakInfo | null
  onClose: () => void
}

function MiniCalendar({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)

  const streakStart = new Date(sy, sm - 1, sd)
  const streakEnd = new Date(ey, em - 1, ed)

  // Guard for empty/invalid dates
  if (!startDate || !endDate) return null

  function renderMonth(year: number, month: number) {
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7  // 0 = Mon

    return (
      <div className="mt-3 bg-gray-50 rounded-xl p-3">
        <p className="text-xs font-bold text-gray-400 text-center mb-2">
          {MONTHS[month]} {year}
        </p>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div key={i} className="text-center" style={{ fontSize: '9px' }}>
              <span className="text-gray-300 font-semibold">{d}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: firstDow }, (_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const dayNum = i + 1
            const cellDate = new Date(year, month, dayNum)
            const inStreak = cellDate >= streakStart && cellDate <= streakEnd
            return (
              <div
                key={dayNum}
                className={`aspect-square flex items-center justify-center rounded-full text-xs font-semibold ${
                  inStreak ? 'bg-orange-400 text-white' : 'text-gray-300'
                }`}
                style={{ fontSize: '10px' }}
              >
                {dayNum}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const spansMonths = sy !== ey || sm !== em

  return (
    <>
      {renderMonth(sy, sm - 1)}
      {spansMonths && renderMonth(ey, em - 1)}
    </>
  )
}

export default function StreakDetailSheet({ best, current, onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function handleClose() {
    setMounted(false)
    closeTimerRef.current = setTimeout(onClose, 280)
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    if (deltaY > 60 && (sheetRef.current?.scrollTop ?? 0) === 0) handleClose()
  }

  const daysAway = best.days - (current?.days ?? 0)
  const newPersonalBest = (current?.days ?? 0) > best.days

  function formatDateRange(start: string, end: string): string {
    const fmt = (d: string) => {
      const [y, m, day] = d.split('-').map(Number)
      return new Date(y, m - 1, day).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    }
    return `${fmt(start)} – ${fmt(end)}`
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Streak details"
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto transition-transform duration-300 ease-out ${mounted ? 'translate-y-0' : 'translate-y-full'}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="px-5 py-4">
          {/* Best streak */}
          <div className="mb-5">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">
              All-Time Best
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-gray-800">🔥{best.days}</span>
              <span className="text-base font-bold text-gray-500">days</span>
            </div>
            <p className="text-sm font-semibold text-gray-600 mt-1">{best.goalTitle}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {best.challengeName} · vs {best.buddyName}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatDateRange(best.startDate, best.endDate)}
            </p>

            <MiniCalendar startDate={best.startDate} endDate={best.endDate} />
          </div>

          {/* Divider + current streak — only shown when current streak exists */}
          {current && (
            <>
              <div className="border-t border-gray-100 my-5" />

              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">
                  Current Streak
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-gray-800">⚡{current.days}</span>
                  <span className="text-base font-bold text-gray-500">days</span>
                </div>
                <p className="text-sm font-semibold text-gray-600 mt-1">{current.goalTitle}</p>
                <p className="text-xs font-semibold mt-2">
                  {newPersonalBest ? (
                    <span className="text-teal-500">🎉 New personal best!</span>
                  ) : daysAway > 0 ? (
                    <span className="text-orange-400">{daysAway} day{daysAway !== 1 ? 's' : ''} away from your best</span>
                  ) : null}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
