'use client'

import { dayCompletionStatus, type DayStatus } from '@/lib/scoring'
import type { Goal, CheckIn } from '@/types/database'
import { addDays } from '@/lib/dateUtils'

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

export default function WeekStrip(props: Props) {
  const todayIndex = (() => {
    for (let i = 0; i < 7; i++) {
      if (addDays(props.weekStart, i) === props.today) return i
    }
    return -1
  })()

  // Column-major layout: each day is a single tappable column containing
  // [day label → my dot → divider → buddy dot]. This makes the entire
  // vertical strip of a day a tap target (Dylan's UX request) instead of
  // just the "me" dot, and lets the buddy dot also drive selection.
  // The names ("You" / buddy) live in a left-hand column outside the buttons.
  //
  // `select-none` + WebkitTapHighlightColor + touch-action stop mobile
  // browsers from text-highlighting day labels when tapped or showing the
  // grey tap flash / triggering double-tap zoom.
  return (
    <div
      className="bg-gray-100 rounded-2xl p-3 mb-4 select-none"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="flex items-stretch gap-2">
        {/* Name column — must mirror the per-button vertical layout so the
            "You" / buddy labels line up with their respective dots. */}
        <div className="w-[56px] flex flex-col py-1">
          {/* Spacer matching the day label inside each button */}
          <div className="text-[9px] font-bold tracking-wider mb-1 invisible">.</div>
          <div className="h-[18px] flex items-center">
            <span className="text-[10px] font-bold text-gray-600 truncate">{props.myName}</span>
          </div>
          <div className="border-t border-gray-200 my-1" />
          <div className="h-[18px] flex items-center">
            <span className="text-[10px] font-bold text-gray-600 truncate">{props.buddyName}</span>
          </div>
        </div>

        {/* 7 day columns. Each is one button. */}
        <div className="flex flex-1 gap-1">
          {DAY_LABELS.map((_, i) => {
            const date = addDays(props.weekStart, i)
            const myState = dayCompletionStatus(
              props.myGoals, date, props.myCheckIns,
              props.today, props.challengeStart, props.challengeEnd,
            )
            const buddyState = dayCompletionStatus(
              props.buddyGoals, date, props.buddyCheckIns,
              props.today, props.challengeStart, props.challengeEnd,
            )
            const isSelected = date === props.selectedDate
            const isTodayCol = i === todayIndex
            const tappable = myState !== 'out-of-range'
            const dayName = DAY_NAMES_LONG[i]
            const [y, m, d] = date.split('-').map(Number)
            const monthName = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long' })
            const aria = `${dayName}, ${monthName} ${d}`
            const labelText = isTodayCol ? 'TODAY' : DAY_LABELS[i]

            const inner = (
              <>
                <div
                  className={`text-[9px] font-bold tracking-wider text-center mb-1 ${
                    isTodayCol ? 'text-teal-600' : 'text-gray-400'
                  }`}
                >
                  {labelText}
                </div>
                <Dot key={`my-${myState}`} state={myState} isSelected={isSelected} />
                <div className="border-t border-gray-200 my-1" />
                <Dot key={`buddy-${buddyState}`} state={buddyState} isSelected={isSelected} />
              </>
            )

            if (tappable) {
              return (
                <button
                  key={date}
                  type="button"
                  aria-label={aria}
                  onClick={() => props.onSelectDay(date)}
                  className={`flex-1 flex flex-col py-1 rounded-md transition active:scale-95 ${
                    isTodayCol ? 'bg-teal-50' : ''
                  }`}
                  style={{ touchAction: 'manipulation' }}
                >
                  {inner}
                </button>
              )
            }
            return (
              <div
                key={date}
                className={`flex-1 flex flex-col py-1 rounded-md ${isTodayCol ? 'bg-teal-50' : ''}`}
              >
                {inner}
              </div>
            )
          })}
        </div>
      </div>

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
