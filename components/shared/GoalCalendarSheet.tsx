'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import type { Goal, CheckIn } from '@/types/database'
import GoalEditButton from '@/components/wrap-up/GoalEditButton'
import { BRAND_GRADIENT } from '@/lib/brand'
import { formatDate, formatYMD } from '@/lib/dateUtils'
import { toggleCheckIn } from '@/app/dashboard/checkin-actions'

interface Props {
  goal: Goal
  checkIns: CheckIn[]
  isOwn: boolean
  isPending: boolean
  isHistorical?: boolean
  startDate: string
  endDate: string
  today: string
  challengeId: string
  myId: string
  onClose: () => void
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function parseYM(s: string): [number, number] {
  const [y, m] = s.split('-').map(Number)
  return [y, m - 1] // 0-based month
}

type DayState =
  | 'done'         // scheduled, completed
  | 'missed'       // scheduled past, not completed
  | 'today-open'   // scheduled today, not yet done
  | 'future'       // scheduled future day
  | 'makeup'       // NON-scheduled day with completion, when an earlier scheduled miss exists
  | 'extra'        // NON-scheduled day with completion, no pending misses
  | 'open'         // NON-scheduled in-range day, no completion (tappable to add)
  | 'value'        // cumulative: logged value
  | 'blank'        // out of challenge range

const GOAL_TYPE_LABEL: Record<string, string> = {
  daily: 'Daily', frequency: 'Frequency',
  milestone: 'Milestone', cumulative: 'Cumulative',
}

export default function GoalCalendarSheet({
  goal, checkIns, isOwn, isPending, isHistorical = false,
  startDate, endDate, today, challengeId, myId, onClose,
}: Props) {
  const [startY, startM] = parseYM(startDate)
  const [endY, endM] = parseYM(endDate)
  const [todayY, todayM] = parseYM(today)

  const startAbs = startY * 12 + startM
  const endAbs = endY * 12 + endM
  const todayAbs = todayY * 12 + todayM

  const initialOffset = Math.min(Math.max(todayAbs, startAbs), endAbs) - startAbs
  const [offset, setOffset] = useState(initialOffset)

  const [, startTransition] = useTransition()
  // localOverrides: date string → true (locally marked done) | false (locally removed)
  const [localOverrides, setLocalOverrides] = useState<Map<string, boolean>>(new Map())

  // Slide-up animation
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  // Animate out then unmount
  function handleClose() {
    setMounted(false)
    setTimeout(onClose, 280)
  }

  // Swipe-to-close
  const sheetRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const touchStartScrollTop = useRef(0)

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY
    touchStartScrollTop.current = sheetRef.current?.scrollTop ?? 0
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    if (deltaY > 60 && touchStartScrollTop.current === 0) handleClose()
  }

  const curAbs = startAbs + offset
  const curYear = Math.floor(curAbs / 12)
  const curMonth = curAbs % 12 // 0-based

  const doneSet = new Set(
    checkIns.filter(c => c.goal_id === goal.id && c.completed).map(c => c.date)
  )

  // Effective done set: base doneSet XORed with local optimistic overrides
  const effectiveDoneSet = new Set(doneSet)
  for (const [d, isDone] of localOverrides) {
    if (isDone) effectiveDoneSet.add(d)
    else effectiveDoneSet.delete(d)
  }

  // For frequency goals: classify each non-scheduled completion as 'makeup' (compensates
  // for an earlier missed scheduled day) or 'extra' (bonus credit, no misses pending).
  // Walks the challenge timeline in order, tracking pending misses.
  const nonScheduledClassification: Record<string, 'makeup' | 'extra'> = {}
  if (goal.type === 'frequency' && goal.schedule_dates && goal.schedule_dates.length > 0) {
    const scheduleSet = new Set(goal.schedule_dates)
    const [sy, sm, sd] = startDate.split('-').map(Number)
    const [ey, em, ed] = endDate.split('-').map(Number)
    const cursor = new Date(sy, sm - 1, sd)
    const stopAt = new Date(ey, em - 1, ed)
    let pendingMisses = 0
    while (cursor <= stopAt) {
      const ds = formatDate(cursor)
      if (ds > today) break
      const scheduled = scheduleSet.has(ds)
      const completed = effectiveDoneSet.has(ds)
      if (scheduled && !completed) {
        pendingMisses++
      } else if (!scheduled && completed) {
        if (pendingMisses > 0) {
          nonScheduledClassification[ds] = 'makeup'
          pendingMisses--
        } else {
          nonScheduledClassification[ds] = 'extra'
        }
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate()
  const firstDow = (new Date(curYear, curMonth, 1).getDay() + 6) % 7 // 0 = Mon

  const cells: (string | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => formatYMD(curYear, curMonth, i + 1)),
  ]

  function getDayState(dateStr: string): DayState {
    if (dateStr < startDate || dateStr > endDate) return 'blank'

    if (goal.type === 'cumulative') {
      const logged = checkIns.some(
        c => c.goal_id === goal.id && c.date === dateStr && c.value != null && c.value > 0
      )
      return logged ? 'value' : 'blank'
    }

    if (goal.type === 'milestone') {
      return effectiveDoneSet.has(dateStr) ? 'done' : 'blank'
    }

    // daily / frequency: check if this day is a committed date
    const isScheduled =
      !goal.schedule_dates || goal.schedule_dates.length === 0 ||
      goal.schedule_dates.includes(dateStr)

    if (!isScheduled) {
      // Non-scheduled: check for completion, classify as makeup/extra/open
      if (effectiveDoneSet.has(dateStr)) {
        return nonScheduledClassification[dateStr] ?? 'extra'
      }
      // Non-scheduled, no completion. Tappable if in-range and past/today.
      if (goal.type === 'frequency' && dateStr <= today) return 'open'
      return 'blank'
    }
    if (effectiveDoneSet.has(dateStr)) return 'done'
    if (dateStr === today) return 'today-open'
    if (dateStr > today) return 'future'
    return 'missed'
  }

  function handleDayToggle(dateStr: string) {
    if (!isOwn || isHistorical || dateStr > today || dateStr < startDate) return
    const currentlyDone = effectiveDoneSet.has(dateStr)
    // Optimistic update
    setLocalOverrides(prev => new Map(prev).set(dateStr, !currentlyDone))
    startTransition(async () => {
      const result = await toggleCheckIn(goal.id, dateStr)
      if (result?.error) {
        // Roll back on failure
        setLocalOverrides(prev => new Map(prev).set(dateStr, currentlyDone))
      }
    })
  }

  function getCumulativeValue(dateStr: string): number {
    return checkIns
      .filter(c => c.goal_id === goal.id && c.date === dateStr && c.value != null)
      .reduce((s, c) => s + (c.value ?? 0), 0)
  }

  const dayNum = (dateStr: string) => parseInt(dateStr.split('-')[2])

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
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto transition-transform duration-300 ease-out ${mounted ? 'translate-y-0' : 'translate-y-full'}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div
          className="px-5 pt-4 pb-5"
          style={{ background: BRAND_GRADIENT }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-lg leading-tight">{goal.title}</p>
              <p className="text-white/70 text-xs mt-0.5 font-semibold">
                {GOAL_TYPE_LABEL[goal.type]}
                {goal.target_count && goal.target_unit
                  ? ` · ${goal.target_count} ${goal.target_unit}`
                  : goal.target_count
                  ? ` · target ${goal.target_count}`
                  : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isOwn && !isPending && !isHistorical && (
                <GoalEditButton
                  goal={goal}
                  challengeId={challengeId}
                  challengeStartDate={startDate}
                  challengeEndDate={endDate}
                  myId={myId}
                />
              )}
              {isPending && <span className="text-white/70 text-sm">⏳</span>}
              <button
                onClick={handleClose}
                className="text-white/60 hover:text-white text-2xl leading-none font-light"
                aria-label="Close"
              >×</button>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="px-4 pt-5 pb-2">

          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setOffset(o => o - 1)}
              disabled={offset === 0}
              className="w-8 h-8 flex items-center justify-center rounded-full text-lg text-gray-500 disabled:opacity-20 hover:bg-gray-100 transition"
            >‹</button>
            <p className="font-black text-gray-800 text-sm">
              {MONTHS[curMonth]} {curYear}
            </p>
            <button
              onClick={() => setOffset(o => o + 1)}
              disabled={offset === endAbs - startAbs}
              className="w-8 h-8 flex items-center justify-center rounded-full text-lg text-gray-500 disabled:opacity-20 hover:bg-gray-100 transition"
            >›</button>
          </div>

          {/* Day-of-week labels */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map((d, i) => (
              <div key={i} className="text-center text-xs font-bold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-2">
            {cells.map((dateStr, i) => {
              if (!dateStr) return <div key={`empty-${i}`} />

              const state = getDayState(dateStr)
              const num = dayNum(dateStr)

              // Cumulative: show value badge
              if (state === 'value') {
                const val = getCumulativeValue(dateStr)
                return (
                  <div key={dateStr} className="flex flex-col items-center">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: BRAND_GRADIENT }}
                    >
                      <span className="text-white text-xs font-black">
                        {val > 99 ? '99+' : val}
                      </span>
                    </div>
                    <span className="text-xs text-gray-300 mt-0.5 leading-none">{num}</span>
                  </div>
                )
              }

              // Blank / out of range
              if (state === 'blank') {
                return (
                  <div key={dateStr} className="flex flex-col items-center">
                    <div className="w-8 h-8 flex items-center justify-center">
                      <span className={`text-xs ${dateStr < startDate || dateStr > endDate ? 'text-gray-200' : 'text-gray-400'}`}>
                        {num}
                      </span>
                    </div>
                  </div>
                )
              }

              // Circle styles
              const isToday = dateStr === today
              const circleStyle: React.CSSProperties =
                state === 'done'
                  ? { background: BRAND_GRADIENT }
                  : state === 'makeup'
                  ? { background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' }
                  : state === 'extra'
                  ? { background: 'linear-gradient(135deg, #5eead4 0%, #2dd4bf 100%)' }
                  : state === 'missed'
                  ? { background: '#fee2e2', border: '2px solid #fca5a5' }
                  : state === 'today-open'
                  ? { background: 'transparent', border: '2px solid #00C9A7' }
                  : state === 'open'
                  ? { background: 'transparent', border: '1px dashed #cbd5e1' }
                  : { background: 'transparent', border: '2px solid #bae6fd' } // future

              const textCls =
                state === 'done' || state === 'makeup' || state === 'extra'
                  ? 'text-white font-bold'
                  : state === 'missed'
                  ? 'text-red-400 font-bold'
                  : state === 'today-open'
                  ? 'text-teal-600 font-bold'
                  : state === 'open'
                  ? 'text-gray-300'
                  : 'text-blue-300 font-semibold'

              const ringCls = isToday
                ? 'ring-2 ring-teal-400 ring-offset-1'
                : ''

              return (
                <div key={dateStr} className="flex flex-col items-center">
                  {(() => {
                    const canToggle = isOwn && !isHistorical && dateStr <= today && state !== 'future'
                    const Tag = canToggle ? 'button' : 'div'
                    return (
                      <Tag
                        {...(canToggle ? { type: 'button', onClick: () => handleDayToggle(dateStr) } : {})}
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${textCls} ${ringCls} ${
                          canToggle ? 'active:scale-90 transition cursor-pointer' : ''
                        }`}
                        style={circleStyle}
                      >
                        <span className="text-xs">{num}</span>
                      </Tag>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        {goal.type !== 'cumulative' && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-5 py-4 text-xs text-gray-400 border-t border-gray-100 mt-2">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: BRAND_GRADIENT }} />
              Done
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full flex-shrink-0 bg-red-100 border border-red-300" />
              Missed
            </span>
            {goal.type === 'frequency' && (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }} />
                  Make-up
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #5eead4, #2dd4bf)' }} />
                  Extra
                </span>
              </>
            )}
            {goal.type !== 'milestone' && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-blue-200" />
                Upcoming
              </span>
            )}
          </div>
        )}
        {goal.type === 'cumulative' && (
          <div className="flex items-center gap-1.5 px-5 py-4 text-xs text-gray-400 border-t border-gray-100 mt-2">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: BRAND_GRADIENT }} />
            Circle shows value logged that day
          </div>
        )}

        {/* Safe area spacer for phones */}
        <div className="h-6" />
      </div>
    </>
  )
}
