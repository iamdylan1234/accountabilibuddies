'use client'

import { dayCompletionStatus, type DayStatus } from '@/lib/scoring'
import type { Goal, CheckIn } from '@/types/database'
import { formatDate, addDays } from '@/lib/dateUtils'

interface Props {
  weekStart: string         // Monday of the displayed week, "YYYY-MM-DD"
  today: string             // "YYYY-MM-DD" in local time
  challengeStart: string
  challengeEnd: string
  myGoals: Goal[]
  buddyGoals: Goal[]
  myCheckIns: CheckIn[]
  buddyCheckIns: CheckIn[]
  myName: string
  buddyName: string
  selectedDate: string
  onSelectDay: (date: string) => void
}

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const DAY_NAMES_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function dotClasses(state: DayStatus, isSelected: boolean): string {
  const base = 'w-[18px] h-[18px] rounded-full mx-auto box-border'
  const ring = isSelected ? ' outline outline-2 outline-offset-2 outline-teal-500' : ''
  const muted = state === 'out-of-range' ? ' opacity-50' : ''
  switch (state) {
    case 'full':
      return `${base} bg-teal-500${ring}${muted}`
    case 'partial':
      // half-fill via conic-gradient + border
      return `${base} border-[1.5px] border-teal-500${ring}${muted}`
    case 'empty':
      return `${base} border-[1.5px] border-gray-300${ring}${muted}`
    case 'future':
      return `${base} border-[1.5px] border-dashed border-gray-300${ring}${muted}`
    case 'rest':
    case 'out-of-range':
      // small dash centred in the cell; render with bg/style on the wrapper, dot itself is invisible
      return `${base} flex items-center justify-center${ring}${muted}`
  }
}

function Dot({ state, isSelected }: { state: DayStatus; isSelected: boolean }) {
  const classes = `${dotClasses(state, isSelected)} animate-dot-pulse`
  if (state === 'rest' || state === 'out-of-range') {
    return (
      <div className={classes}>
        <div className="w-[8px] h-[2px] bg-gray-300 rounded-full" />
      </div>
    )
  }
  if (state === 'partial') {
    return (
      <div
        className={classes}
        style={{ background: 'conic-gradient(#14b8a6 0% 50%, transparent 50% 100%)' }}
      />
    )
  }
  return <div className={classes} />
}

function Row({
  name, goals, checkIns, weekStart, today, challengeStart, challengeEnd,
  selectedDate, onSelectDay, isSelectable, todayIndex,
}: {
  name: string
  goals: Goal[]
  checkIns: CheckIn[]
  weekStart: string
  today: string
  challengeStart: string
  challengeEnd: string
  selectedDate: string
  onSelectDay: (d: string) => void
  isSelectable: boolean
  todayIndex: number
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-[10px] font-bold text-gray-600 w-[56px] truncate">{name}</span>
      <div className="flex gap-1 flex-1">
        {DAY_LABELS.map((_, i) => {
          const date = addDays(weekStart, i)
          const state = dayCompletionStatus(goals, date, checkIns, today, challengeStart, challengeEnd)
          const isSelected = date === selectedDate
          const tappable = isSelectable && state !== 'out-of-range'
          const isTodayCol = i === todayIndex
          const dayName = DAY_NAMES_LONG[i]
          const [y, m, d] = date.split('-').map(Number)
          const monthName = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long' })
          const aria = `${dayName}, ${monthName} ${d}`
          if (tappable) {
            return (
              <button
                key={date}
                type="button"
                aria-label={aria}
                onClick={() => onSelectDay(date)}
                className={`flex-1 text-center transition active:scale-95${isTodayCol ? ' bg-teal-50 rounded-md' : ''}`}
              >
                <Dot key={state} state={state} isSelected={isSelected} />
              </button>
            )
          }
          return (
            <div key={date} className={`flex-1 text-center${isTodayCol ? ' bg-teal-50 rounded-md' : ''}`}>
              <Dot key={state} state={state} isSelected={false} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function WeekStrip(props: Props) {
  const todayIndex = (() => {
    for (let i = 0; i < 7; i++) {
      if (addDays(props.weekStart, i) === props.today) return i
    }
    return -1
  })()

  return (
    <div className="bg-gray-100 rounded-2xl p-3 mb-4">
      {/* Day labels — rendered once at top */}
      <div className="flex items-center gap-2 mb-1">
        <span className="w-[56px]" />
        <div className="flex gap-1 flex-1">
          {DAY_LABELS.map((label, i) => (
            <span
              key={label}
              className={`flex-1 text-center text-[9px] font-bold tracking-wider${
                i === todayIndex ? ' text-teal-600' : ' text-gray-400'
              }`}
            >
              {i === todayIndex ? 'TODAY' : label}
            </span>
          ))}
        </div>
      </div>
      <Row
        name={props.myName}
        goals={props.myGoals}
        checkIns={props.myCheckIns}
        weekStart={props.weekStart}
        today={props.today}
        challengeStart={props.challengeStart}
        challengeEnd={props.challengeEnd}
        selectedDate={props.selectedDate}
        onSelectDay={props.onSelectDay}
        isSelectable={true}
        todayIndex={todayIndex}
      />
      <div className="border-t border-gray-200 my-1" />
      <Row
        name={props.buddyName}
        goals={props.buddyGoals}
        checkIns={props.buddyCheckIns}
        weekStart={props.weekStart}
        today={props.today}
        challengeStart={props.challengeStart}
        challengeEnd={props.challengeEnd}
        selectedDate={props.selectedDate}
        onSelectDay={props.onSelectDay}
        isSelectable={false}
        todayIndex={todayIndex}
      />
      {/* Legend — decodes the dot symbols so the strip is self-explanatory */}
      <div className="flex items-center justify-center gap-3 text-[9px] text-gray-400 mt-2 pt-2 border-t border-gray-200">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-teal-500" />
          full
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-full border border-teal-500"
            style={{ background: 'conic-gradient(#14b8a6 0% 50%, transparent 50% 100%)' }}
          />
          partial
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full border border-gray-300" />
          none
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-[2px] bg-gray-300 rounded-full" />
          rest
        </span>
      </div>
    </div>
  )
}
