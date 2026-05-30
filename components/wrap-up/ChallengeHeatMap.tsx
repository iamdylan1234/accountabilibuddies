'use client'

import type { Goal, CheckIn } from '@/types/database'
import { formatYMD } from '@/lib/dateUtils'
import { dailyCompletionPct, intensityLevel } from '@/lib/heatmap'

interface Props {
  myGoals: Goal[]
  buddyGoals: Goal[]
  myCheckIns: CheckIn[]
  buddyCheckIns: CheckIn[]
  myName: string
  buddyName: string
  startDate: string  // "YYYY-MM-DD"
  endDate: string
  today: string
}

/** Class for each intensity level. -2 = outside challenge window (blank). */
function cellClass(level: -2 | -1 | 0 | 1 | 2 | 3 | 4): string {
  switch (level) {
    case -2: return 'bg-transparent'                              // outside window
    case -1: return 'border border-gray-300 bg-transparent'       // rest day
    case 0:  return 'bg-gray-200'
    case 1:  return 'bg-teal-200'
    case 2:  return 'bg-teal-400'
    case 3:  return 'bg-teal-600'
    case 4:  return 'bg-teal-800'
  }
}

/**
 * Compute the date list for the calendar grid: aligned to weeks (M..S),
 * spanning from the week containing `startDate` through the week containing
 * `endDate`. Returns an array of YYYY-MM-DD strings.
 */
function calendarDates(startDate: string, endDate: string): string[] {
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end   = new Date(ey, em - 1, ed)

  // Back up to Monday of the start week. JS Sunday=0 → treat as 7 so Mon=1 is the first day.
  const startDow = start.getDay() === 0 ? 7 : start.getDay()
  start.setDate(start.getDate() - (startDow - 1))

  // Forward to Sunday of the end week.
  const endDow = end.getDay() === 0 ? 7 : end.getDay()
  end.setDate(end.getDate() + (7 - endDow))

  const dates: string[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(formatYMD(d.getFullYear(), d.getMonth(), d.getDate()))
  }
  return dates
}

function HeatRow({
  label, goals, checkIns, dates, startDate, endDate, today,
}: {
  label: string
  goals: Goal[]
  checkIns: CheckIn[]
  dates: string[]
  startDate: string
  endDate: string
  today: string
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-1.5">{label}</p>
      <div className="grid grid-cols-7 gap-1">
        {dates.map(date => {
          const inWindow = date >= startDate && date <= endDate
          const level: -2 | -1 | 0 | 1 | 2 | 3 | 4 = !inWindow
            ? -2
            : intensityLevel(dailyCompletionPct(goals, checkIns, date))
          const isToday = date === today
          const baseClass = `aspect-square rounded ${cellClass(level)}`
          const ringClass = isToday && inWindow ? 'ring-2 ring-teal-500 ring-offset-1' : ''
          return <div key={date} className={`${baseClass} ${ringClass}`} title={date} />
        })}
      </div>
    </div>
  )
}

/**
 * 30-day calendar heat-map: one row per buddy, day-of-week aligned. Each cell's
 * intensity reflects the % of that day's scheduled goals completed. Today (for
 * the active view) has a ring. Outside-challenge days are blank. Rest days
 * (0 scheduled goals) are faint outlines, distinct from 0% done.
 */
export default function ChallengeHeatMap({
  myGoals, buddyGoals, myCheckIns, buddyCheckIns,
  myName, buddyName, startDate, endDate, today,
}: Props) {
  const dates = calendarDates(startDate, endDate)

  return (
    <section className="mb-6">
      <h2 className="w-full text-center bg-white text-gray-600 text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-full mb-2 border border-gray-200">
        Heat-map
      </h2>
      <div className="rounded-2xl bg-gray-100 p-3 space-y-3">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 gap-1 text-[10px] text-gray-400 font-semibold text-center select-none">
          <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
        </div>
        <HeatRow label={myName}    goals={myGoals}    checkIns={myCheckIns}    dates={dates} startDate={startDate} endDate={endDate} today={today} />
        <HeatRow label={buddyName} goals={buddyGoals} checkIns={buddyCheckIns} dates={dates} startDate={startDate} endDate={endDate} today={today} />
      </div>
    </section>
  )
}
