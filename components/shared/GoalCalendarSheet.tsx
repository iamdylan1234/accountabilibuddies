'use client'

import { useState } from 'react'
import type { Goal, CheckIn } from '@/types/database'
import GoalEditButton from '@/components/wrap-up/GoalEditButton'

interface Props {
  goal: Goal
  checkIns: CheckIn[]
  isOwn: boolean
  isPending: boolean
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

function fmt(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseYM(s: string): [number, number] {
  const [y, m] = s.split('-').map(Number)
  return [y, m - 1] // 0-based month
}

type DayState =
  | 'done'         // completed past/today
  | 'missed'       // scheduled, not completed, in the past
  | 'today-open'   // scheduled today, not yet done
  | 'future'       // scheduled future day
  | 'value'        // cumulative: logged value
  | 'blank'        // not scheduled or out of challenge range

const GOAL_TYPE_LABEL: Record<string, string> = {
  daily: 'Daily', frequency: 'Frequency',
  milestone: 'Milestone', cumulative: 'Cumulative',
}

export default function GoalCalendarSheet({
  goal, checkIns, isOwn, isPending,
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

  const curAbs = startAbs + offset
  const curYear = Math.floor(curAbs / 12)
  const curMonth = curAbs % 12 // 0-based

  const doneSet = new Set(
    checkIns.filter(c => c.goal_id === goal.id && c.completed).map(c => c.date)
  )

  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate()
  const firstDow = (new Date(curYear, curMonth, 1).getDay() + 6) % 7 // 0 = Mon

  const cells: (string | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => fmt(curYear, curMonth, i + 1)),
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
      return doneSet.has(dateStr) ? 'done' : 'blank'
    }

    // daily / frequency: check if this day is a committed date
    const isScheduled =
      !goal.schedule_dates || goal.schedule_dates.length === 0 ||
      goal.schedule_dates.includes(dateStr)

    if (!isScheduled) return 'blank'
    if (doneSet.has(dateStr)) return 'done'
    if (dateStr === today) return 'today-open'
    if (dateStr > today) return 'future'
    return 'missed'
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
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div
          className="px-5 pt-4 pb-5"
          style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
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
              {isOwn && !isPending && (
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
                onClick={onClose}
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
                      style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
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
                  ? { background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }
                  : state === 'missed'
                  ? { background: '#fee2e2', border: '2px solid #fca5a5' }
                  : state === 'today-open'
                  ? { background: 'transparent', border: '2px solid #00C9A7' }
                  : { background: 'transparent', border: '2px solid #bae6fd' } // future

              const textCls =
                state === 'done'
                  ? 'text-white font-bold'
                  : state === 'missed'
                  ? 'text-red-400 font-bold'
                  : state === 'today-open'
                  ? 'text-teal-600 font-bold'
                  : 'text-blue-300 font-semibold'

              const ringCls = isToday
                ? 'ring-2 ring-teal-400 ring-offset-1'
                : ''

              return (
                <div key={dateStr} className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${textCls} ${ringCls}`}
                    style={circleStyle}
                  >
                    <span className="text-xs">{num}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        {goal.type !== 'cumulative' && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-4 text-xs text-gray-400 border-t border-gray-100 mt-2">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }} />
              Done
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full flex-shrink-0 bg-red-100 border border-red-300" />
              Missed
            </span>
            {goal.type !== 'milestone' && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full flex-shrink-0 border border-sky-200" />
                Upcoming
              </span>
            )}
          </div>
        )}
        {goal.type === 'cumulative' && (
          <div className="flex items-center gap-1.5 px-5 py-4 text-xs text-gray-400 border-t border-gray-100 mt-2">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }} />
            Circle shows value logged that day
          </div>
        )}

        {/* Safe area spacer for phones */}
        <div className="h-6" />
      </div>
    </>
  )
}
