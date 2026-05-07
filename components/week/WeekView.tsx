'use client'

import { useState } from 'react'
import { getWeekStart, scoreChallenge, getCurrentStreak } from '@/lib/scoring'
import GoalCalendarSheet from '@/components/shared/GoalCalendarSheet'
import ScoreTileGrid from '@/components/shared/ScoreTileGrid'
import type { Goal, CheckIn, Profile } from '@/types/database'
import { BRAND_GRADIENT, BRAND_GRADIENT_H } from '@/lib/brand'
import { formatDate } from '@/lib/dateUtils'

interface Props {
  myGoals: Goal[]
  buddyGoals: Goal[]
  myCheckIns: CheckIn[]
  buddyCheckIns: CheckIn[]
  myProfile: Profile
  buddyProfile: Profile | null
  challengeName: string
  startDate: string
  endDate: string
  totalDays: number
  challengeId: string
  myId: string
}

// Day names indexed 0–7 to cover Mon(0)…Sun(6) plus next-Mon(7)
// Offset -1 maps to last Sunday.
const DAY_NAMES: Record<number, string> = {
  [-1]: 'Sunday', 0: 'Monday', 1: 'Tuesday', 2: 'Wednesday', 3: 'Thursday', 4: 'Friday', 5: 'Saturday', 6: 'Sunday', 7: 'Monday',
}

// ── Types ─────────────────────────────────────────────────────────────────────
type SheetTarget = { goal: Goal; checkIns: CheckIn[]; isOwn: boolean }

// ── Module-level sub-components ───────────────────────────────────────────────
// Defined outside WeekView so React never sees a new component type on re-render.

interface WeekSummaryCardProps {
  goal: Goal
  allCheckIns: CheckIn[]
  isOwn: boolean
  weekStartStr: string
  todayStr: string
  todayOffset: number
  onOpen: (target: SheetTarget) => void
}

function WeekSummaryCard({
  goal, allCheckIns, isOwn, weekStartStr, todayStr, todayOffset, onOpen,
}: WeekSummaryCardProps) {
  const weekDone = allCheckIns.filter(
    c => c.goal_id === goal.id && c.date >= weekStartStr && c.date <= todayStr && c.completed
  )

  let label = ''
  let pct = 0
  let showBar = true

  if (goal.type === 'milestone') {
    const done = allCheckIns.some(c => c.goal_id === goal.id && c.completed)
    label = done ? '✓ Done' : 'Not yet'
    pct   = done ? 100 : 0
    showBar = false
  } else if (goal.type === 'cumulative') {
    const total = allCheckIns
      .filter(c => c.goal_id === goal.id && c.date >= weekStartStr && c.date <= todayStr && c.value != null)
      .reduce((s, c) => s + (c.value ?? 0), 0)
    label   = total > 0 ? `+${total}${goal.target_unit ? ' ' + goal.target_unit : ''}` : '—'
    showBar = false
  } else if (goal.type === 'frequency') {
    const scheduledThisWeek = goal.schedule_dates?.filter(d => d >= weekStartStr && d <= todayStr) ?? []
    const done = weekDone.length
    if (scheduledThisWeek.length > 0) {
      label = `${done}/${scheduledThisWeek.length}`
      pct   = Math.round((done / scheduledThisWeek.length) * 100)
    } else {
      label = done > 0 ? `${done} done` : '—'
      pct   = 0
    }
  } else {
    // daily
    const elapsed = todayOffset + 1
    const done    = weekDone.length
    label = `${done}/${elapsed}`
    pct   = elapsed > 0 ? Math.round((done / elapsed) * 100) : 0
  }

  const complete = showBar && pct === 100

  return (
    <button
      type="button"
      onClick={() => onOpen({ goal, checkIns: allCheckIns, isOwn })}
      className={`w-full text-left rounded-xl px-4 py-3 transition active:scale-95 hover:opacity-90 ${
        complete ? 'text-white' : 'bg-gray-50 text-gray-700'
      }`}
      style={complete ? { background: BRAND_GRADIENT } : {}}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold flex-1 leading-tight">{goal.title}</span>
        <span className={`text-xs font-black flex-shrink-0 ${complete ? 'text-white/80' : 'text-teal-600'}`}>
          {label}
        </span>
      </div>
      {showBar && (
        <div className={`mt-2 h-1 rounded-full overflow-hidden ${complete ? 'bg-white/30' : 'bg-gray-200'}`}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: complete ? 'rgba(255,255,255,0.7)' : BRAND_GRADIENT_H,
            }}
          />
        </div>
      )}
    </button>
  )
}

interface GoalCardProps {
  goal: Goal
  checkIns: CheckIn[]
  allCheckIns: CheckIn[]
  isOwn: boolean
  isFuture: boolean
  todayStr: string
  selectedStr: string
  onOpen: (target: SheetTarget) => void
}

function GoalCard({
  goal, checkIns, allCheckIns, isOwn, isFuture, todayStr, selectedStr, onOpen,
}: GoalCardProps) {
  const done   = checkIns.some(c => c.goal_id === goal.id && c.completed)
  const streak = getCurrentStreak(goal, allCheckIns, isFuture ? todayStr : selectedStr)

  if (goal.type === 'cumulative') {
    const total = checkIns
      .filter(c => c.goal_id === goal.id && c.value != null)
      .reduce((s, c) => s + (c.value ?? 0), 0)
    const cardStyle = done
      ? { background: BRAND_GRADIENT }
      : { background: '#f9fafb' }
    return (
      <button type="button" onClick={() => onOpen({ goal, checkIns: allCheckIns, isOwn })}
        className="w-full text-left rounded-xl px-4 py-3 transition active:scale-95 hover:opacity-90"
        style={cardStyle}>
        <p className={`text-sm font-semibold ${done ? 'text-white' : 'text-gray-700'}`}>
          {goal.title}
        </p>
        <p className={`text-xs mt-0.5 ${done ? 'text-white/70' : 'text-gray-400'}`}>
          {total > 0 ? `+${total}${goal.target_unit ? ' ' + goal.target_unit : ''}` : 'Nothing logged'}
        </p>
      </button>
    )
  }

  const cardStyle = done
    ? { background: BRAND_GRADIENT }
    : { background: '#f9fafb' }

  return (
    <button type="button" onClick={() => onOpen({ goal, checkIns: allCheckIns, isOwn })}
      className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition active:scale-95 hover:opacity-90 ${
        done ? 'text-white' : 'text-gray-700'
      }`}
      style={cardStyle}>
      <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
        done ? 'border-white bg-white/30' : 'border-gray-300'
      }`}>
        {done && <span className="text-white text-xs font-bold">✓</span>}
      </span>
      <span className="text-sm font-semibold flex-1">{goal.title}</span>
      {streak >= 2 && (
        <span className={`text-xs font-bold ${done ? 'text-white/80' : 'text-orange-400'}`}>🔥{streak}</span>
      )}
    </button>
  )
}

function EmptyColumn() {
  return (
    <div className="flex items-center justify-center rounded-xl px-4 py-3 border border-dashed border-gray-200 min-h-[46px]">
      <span className="text-xs text-gray-300 font-semibold">No goals</span>
    </div>
  )
}

export default function WeekView({
  myGoals, buddyGoals, myCheckIns, buddyCheckIns,
  myProfile, buddyProfile, challengeName, startDate, endDate,
  totalDays, challengeId, myId,
}: Props) {
  const now = new Date()
  const todayStr = formatDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  const currentWeekStart = getWeekStart(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  const weekStartStr = formatDate(currentWeekStart)

  const todayOffset = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - currentWeekStart.getTime()) / 86400000
  )
  const [dayOffset, setDayOffset] = useState(todayOffset)

  // Always allow reaching Yesterday and Tomorrow, even across week boundaries.
  // Monday (todayOffset=0): allow offset -1  → last Sunday (yesterday)
  // Sunday  (todayOffset=6): allow offset  7 → next Monday (tomorrow)
  const minOffset = todayOffset === 0 ? -1 : 0
  const maxOffset = todayOffset === 6 ?  7 : 6

  // Date arithmetic handles negative offsets and offsets > 6 correctly.
  const selectedDate = new Date(
    currentWeekStart.getFullYear(),
    currentWeekStart.getMonth(),
    currentWeekStart.getDate() + dayOffset,
  )
  const selectedStr = formatDate(selectedDate)
  const isToday = selectedStr === todayStr
  const isFuture = selectedStr > todayStr
  const isYesterday = dayOffset === -1
  const isTomorrow  = dayOffset === maxOffset && maxOffset === 7

  const [sheet, setSheet] = useState<SheetTarget | null>(null)

  // Day-filtered check-ins for the selected day
  const dayMy    = myCheckIns.filter(c => c.date === selectedStr)
  const dayBuddy = buddyCheckIns.filter(c => c.date === selectedStr)

  // Scoring: week to date (always Mon–today, unaffected by cross-week navigation)
  const weekMyForScoring = myCheckIns.filter(c => {
    const goal = myGoals.find(g => g.id === c.goal_id)
    if (goal?.type === 'milestone') return c.date <= todayStr
    return c.date >= weekStartStr && c.date <= todayStr
  })
  const weekBuddyForScoring = buddyCheckIns.filter(c => {
    const goal = buddyGoals.find(g => g.id === c.goal_id)
    if (goal?.type === 'milestone') return c.date <= todayStr
    return c.date >= weekStartStr && c.date <= todayStr
  })

  const myScore    = scoreChallenge(myGoals,    weekMyForScoring,    7, weekStartStr, todayStr)
  const buddyScore = scoreChallenge(buddyGoals, weekBuddyForScoring, 7, weekStartStr, todayStr)
  const iWon       = myScore > buddyScore
  const tied       = myScore === buddyScore
  const bothPerfect = myScore === 100 && buddyScore === 100

  // ── Goal lists ─────────────────────────────────────────────────────────────
  // For the week-summary view (isToday) show ALL goals of each type.
  // For the single-day view, filter frequency goals to those scheduled on
  // that specific day — otherwise every frequency goal would appear on every
  // day regardless of its schedule, which is confusing and incorrect.

  const myMilestoneGoals    = myGoals.filter(g => g.type === 'milestone')
  const buddyMilestoneGoals = buddyGoals.filter(g => g.type === 'milestone')

  // Daily Goals section:
  //   Week summary (isToday): only type=daily goals
  //   Specific day: type=daily + frequency goals that are scheduled for that day
  //   (a scheduled frequency goal is a daily commitment on its day)
  const myDailyGoals = isToday
    ? myGoals.filter(g => g.type === 'daily')
    : myGoals.filter(g =>
        g.type === 'daily' ||
        (g.type === 'frequency' &&
          g.schedule_dates && g.schedule_dates.length > 0 &&
          g.schedule_dates.includes(selectedStr))
      )

  const buddyDailyGoals = isToday
    ? buddyGoals.filter(g => g.type === 'daily')
    : buddyGoals.filter(g =>
        g.type === 'daily' ||
        (g.type === 'frequency' &&
          g.schedule_dates && g.schedule_dates.length > 0 &&
          g.schedule_dates.includes(selectedStr))
      )

  // Target Goals section:
  //   Week summary (isToday): all frequency + cumulative goals
  //   Specific day: cumulative + frequency goals NOT scheduled for this day
  //   (these remain visible on every day as ongoing tracking reference)
  const myTargetGoals = isToday
    ? myGoals.filter(g => g.type === 'frequency' || g.type === 'cumulative')
    : myGoals.filter(g =>
        g.type === 'cumulative' ||
        (g.type === 'frequency' && (
          !g.schedule_dates || g.schedule_dates.length === 0 ||
          !g.schedule_dates.includes(selectedStr)
        ))
      )

  const buddyTargetGoals = isToday
    ? buddyGoals.filter(g => g.type === 'frequency' || g.type === 'cumulative')
    : buddyGoals.filter(g =>
        g.type === 'cumulative' ||
        (g.type === 'frequency' && (
          !g.schedule_dates || g.schedule_dates.length === 0 ||
          !g.schedule_dates.includes(selectedStr)
        ))
      )

  function renderSection(label: string, myGoalList: Goal[], buddyGoalList: Goal[]) {
    if (myGoalList.length === 0 && buddyGoalList.length === 0) return null
    return (
      <div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">{label}</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            {myGoalList.length === 0 ? <EmptyColumn /> : myGoalList.map(goal => isToday
              ? <WeekSummaryCard key={goal.id} goal={goal} allCheckIns={myCheckIns} isOwn={true}
                  weekStartStr={weekStartStr} todayStr={todayStr} todayOffset={todayOffset}
                  onOpen={setSheet} />
              : <GoalCard key={goal.id} goal={goal} checkIns={dayMy} allCheckIns={myCheckIns} isOwn={true}
                  isFuture={isFuture} todayStr={todayStr} selectedStr={selectedStr}
                  onOpen={setSheet} />
            )}
          </div>
          <div className="space-y-2">
            {buddyGoalList.length === 0 ? <EmptyColumn /> : buddyGoalList.map(goal => isToday
              ? <WeekSummaryCard key={goal.id} goal={goal} allCheckIns={buddyCheckIns} isOwn={false}
                  weekStartStr={weekStartStr} todayStr={todayStr} todayOffset={todayOffset}
                  onOpen={setSheet} />
              : <GoalCard key={goal.id} goal={goal} checkIns={dayBuddy} allCheckIns={buddyCheckIns} isOwn={false}
                  isFuture={isFuture} todayStr={todayStr} selectedStr={selectedStr}
                  onOpen={setSheet} />
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Banner label helpers ───────────────────────────────────────────────────
  function bannerTitle() {
    if (isToday)     return 'This Week'
    if (isYesterday) return 'Yesterday'
    if (isTomorrow)  return 'Tomorrow'
    return DAY_NAMES[dayOffset] ?? '—'
  }

  function bannerSub() {
    if (isToday)   return 'Week to date'
    if (isFuture)  return 'Upcoming'
    if (dayOffset === -1) return 'Last week'
    return 'Past'
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Banner */}
      <div
        className="rounded-2xl px-4 py-3 mb-4 text-white"
        style={{ background: BRAND_GRADIENT }}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => setDayOffset(o => Math.max(minOffset, o - 1))}
            disabled={dayOffset === minOffset}
            className="w-8 h-8 flex items-center justify-center rounded-full transition disabled:opacity-30 hover:bg-white/20"
            aria-label="Previous day"
          >‹</button>
          <div className="text-center">
            <p className="font-black text-base">{bannerTitle()}</p>
            <p className="text-white/70 text-xs font-semibold mt-0.5">{bannerSub()}</p>
          </div>
          <button
            onClick={() => setDayOffset(o => Math.min(maxOffset, o + 1))}
            disabled={dayOffset === maxOffset}
            className="w-8 h-8 flex items-center justify-center rounded-full transition disabled:opacity-30 hover:bg-white/20"
            aria-label="Next day"
          >›</button>
        </div>
      </div>

      {/* Score tiles */}
      <ScoreTileGrid
        left={{
          name: myProfile?.name ?? 'Me',
          mainValue: `${myScore}%`,
          subLabel: 'week score',
          isWinner: !tied && iWon,
        }}
        right={{
          name: buddyProfile?.name ?? 'Buddy',
          mainValue: `${buddyScore}%`,
          subLabel: 'week score',
          isWinner: !tied && !iWon,
        }}
        tied={tied}
        bothPerfect={bothPerfect}
        selectNone
      />

      {/* "Today" jump pill — only visible when browsing a specific day */}
      {!isToday && (
        <div className="flex justify-center mb-3">
          <button
            onClick={() => setDayOffset(todayOffset)}
            className="text-xs font-bold px-4 py-1.5 rounded-full text-white transition active:scale-95 hover:opacity-90"
            style={{ background: BRAND_GRADIENT }}
          >
            ↩ Today
          </button>
        </div>
      )}

      <div className="space-y-6">
        {renderSection('Daily Goals', myDailyGoals,     buddyDailyGoals)}
        {renderSection('Ongoing',     myTargetGoals,    buddyTargetGoals)}
        {renderSection('Milestones',  myMilestoneGoals, buddyMilestoneGoals)}
      </div>

      {/* Empty state for specific days with no goals */}
      {!isToday && myTargetGoals.length === 0 && myDailyGoals.length === 0 && myMilestoneGoals.length === 0 &&
        buddyTargetGoals.length === 0 && buddyDailyGoals.length === 0 && buddyMilestoneGoals.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">😴</p>
          <p className="font-semibold text-sm">Rest day</p>
          <p className="text-xs mt-1">No goals scheduled for this day</p>
        </div>
      )}

      {sheet && (
        <GoalCalendarSheet
          goal={sheet.goal}
          checkIns={sheet.checkIns}
          isOwn={sheet.isOwn}
          isPending={false}
          startDate={startDate}
          endDate={endDate}
          today={todayStr}
          challengeId={challengeId}
          myId={myId}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
