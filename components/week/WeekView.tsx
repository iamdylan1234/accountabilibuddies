'use client'

import { useState } from 'react'
import { getWeekStart, scoreChallenge, getCurrentStreak } from '@/lib/scoring'
import GoalCalendarSheet from '@/components/shared/GoalCalendarSheet'
import type { Goal, CheckIn, Profile } from '@/types/database'

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

function fmt(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

export default function WeekView({
  myGoals, buddyGoals, myCheckIns, buddyCheckIns,
  myProfile, buddyProfile, challengeName, startDate, endDate,
  totalDays, challengeId, myId,
}: Props) {
  const now = new Date()
  const todayStr = fmt(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  const currentWeekStart = getWeekStart(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  const weekStartStr = fmt(currentWeekStart)

  const todayOffset = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - currentWeekStart.getTime()) / 86400000
  )
  const [dayOffset, setDayOffset] = useState(todayOffset)

  const selectedDate = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate() + dayOffset)
  const selectedStr = fmt(selectedDate)
  const isToday = selectedStr === todayStr
  const isFuture = selectedStr > todayStr

  type SheetTarget = { goal: Goal; checkIns: CheckIn[]; isOwn: boolean }
  const [sheet, setSheet] = useState<SheetTarget | null>(null)

  // Day-filtered check-ins for the selected day
  const dayMy = myCheckIns.filter(c => c.date === selectedStr)
  const dayBuddy = buddyCheckIns.filter(c => c.date === selectedStr)

  // Scoring: week to date
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

  const myScore = scoreChallenge(myGoals, weekMyForScoring, 7, weekStartStr, todayStr)
  const buddyScore = scoreChallenge(buddyGoals, weekBuddyForScoring, 7, weekStartStr, todayStr)
  const iWon = myScore > buddyScore
  const tied = myScore === buddyScore
  const bothPerfect = myScore === 100 && buddyScore === 100

  function tileLabel(isWinner: boolean) {
    if (bothPerfect) return <p className="text-xs font-black text-yellow-300 mb-1">🎉 Perfect!</p>
    if (isWinner) return <p className="text-xs font-black text-yellow-300 mb-1">⚡ AHEAD</p>
    if (tied) return <p className="text-xs font-black text-white/50 mb-1">💪 Keep Going</p>
    return <p className="text-xs mb-1">&nbsp;</p>
  }

  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Section splits
  const myDailyGoals = myGoals.filter(g => g.type === 'daily')
  const buddyDailyGoals = buddyGoals.filter(g => g.type === 'daily')
  const myTargetGoals = myGoals.filter(g => g.type === 'frequency' || g.type === 'cumulative')
  const buddyTargetGoals = buddyGoals.filter(g => g.type === 'frequency' || g.type === 'cumulative')
  const myMilestoneGoals = myGoals.filter(g => g.type === 'milestone')
  const buddyMilestoneGoals = buddyGoals.filter(g => g.type === 'milestone')

  // ── Week-summary card (shown when isToday) ───────────────────────────────
  function WeekSummaryCard({ goal, allCheckIns, isOwn }: { goal: Goal; allCheckIns: CheckIn[]; isOwn: boolean }) {
    const weekDone = allCheckIns.filter(
      c => c.goal_id === goal.id && c.date >= weekStartStr && c.date <= todayStr && c.completed
    )

    let label = ''
    let pct = 0
    let showBar = true

    if (goal.type === 'milestone') {
      const done = allCheckIns.some(c => c.goal_id === goal.id && c.completed)
      label = done ? '✓ Done' : 'Not yet'
      pct = done ? 100 : 0
      showBar = false
    } else if (goal.type === 'cumulative') {
      const total = allCheckIns
        .filter(c => c.goal_id === goal.id && c.date >= weekStartStr && c.date <= todayStr && c.value != null)
        .reduce((s, c) => s + (c.value ?? 0), 0)
      label = total > 0 ? `+${total}${goal.target_unit ? ' ' + goal.target_unit : ''}` : '—'
      showBar = false
    } else if (goal.type === 'frequency') {
      const scheduledThisWeek = goal.schedule_dates?.filter(d => d >= weekStartStr && d <= todayStr) ?? []
      const done = weekDone.length
      if (scheduledThisWeek.length > 0) {
        label = `${done}/${scheduledThisWeek.length}`
        pct = Math.round((done / scheduledThisWeek.length) * 100)
      } else {
        label = done > 0 ? `${done} done` : '—'
        pct = 0
      }
    } else {
      // daily
      const elapsed = dayOffset + 1
      const done = weekDone.length
      label = `${done}/${elapsed}`
      pct = elapsed > 0 ? Math.round((done / elapsed) * 100) : 0
    }

    const complete = showBar && pct === 100

    return (
      <button
        type="button"
        onClick={() => setSheet({ goal, checkIns: allCheckIns, isOwn })}
        className={`w-full text-left rounded-xl px-4 py-3 transition active:scale-95 hover:opacity-90 ${
          complete ? 'text-white' : 'bg-gray-50 text-gray-700'
        }`}
        style={complete ? { background: 'linear-gradient(135deg, #00C9A7, #0077B6)' } : {}}
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
                background: complete ? 'rgba(255,255,255,0.7)' : 'linear-gradient(90deg, #00C9A7, #0077B6)',
              }}
            />
          </div>
        )}
      </button>
    )
  }

  // ── Single-day goal card (shown when not today) ───────────────────────────
  function GoalCard({ goal, checkIns, allCheckIns, isOwn }: { goal: Goal; checkIns: CheckIn[]; allCheckIns: CheckIn[]; isOwn: boolean }) {
    const done = checkIns.some(c => c.goal_id === goal.id && c.completed)
    const streak = getCurrentStreak(goal, allCheckIns, isFuture ? todayStr : selectedStr)

    if (goal.type === 'cumulative') {
      const total = checkIns
        .filter(c => c.goal_id === goal.id && c.value != null)
        .reduce((s, c) => s + (c.value ?? 0), 0)
      const cardStyle = done
        ? { background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }
        : isFuture ? { background: '#f0f9ff', border: '1px solid #bae6fd' }
        : { background: '#f9fafb' }
      return (
        <button type="button" onClick={() => setSheet({ goal, checkIns: allCheckIns, isOwn })}
          className="w-full text-left rounded-xl px-4 py-3 transition active:scale-95 hover:opacity-90"
          style={cardStyle}>
          <p className={`text-sm font-semibold ${done ? 'text-white' : isFuture ? 'text-blue-700' : 'text-gray-700'}`}>
            {goal.title}
          </p>
          <p className={`text-xs mt-0.5 ${done ? 'text-white/70' : isFuture ? 'text-blue-400' : 'text-gray-400'}`}>
            {total > 0 ? `+${total}${goal.target_unit ? ' ' + goal.target_unit : ''}` : isFuture ? 'Upcoming' : 'Nothing logged'}
          </p>
        </button>
      )
    }

    const cardStyle = done
      ? { background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }
      : isFuture ? { background: '#f0f9ff', border: '1px solid #bae6fd' }
      : { background: '#f9fafb' }

    return (
      <button type="button" onClick={() => setSheet({ goal, checkIns: allCheckIns, isOwn })}
        className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition active:scale-95 hover:opacity-90 ${
          done ? 'text-white' : isFuture ? 'text-blue-700' : 'text-gray-700'
        }`}
        style={cardStyle}>
        <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
          done ? 'border-white bg-white/30' : isFuture ? 'border-blue-300' : 'border-gray-300'
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

  function renderSection(
    label: string,
    myGoalList: Goal[],
    buddyGoalList: Goal[],
  ) {
    if (myGoalList.length === 0 && buddyGoalList.length === 0) return null
    return (
      <div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">{label}</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            {myGoalList.map(goal => isToday
              ? <WeekSummaryCard key={goal.id} goal={goal} allCheckIns={myCheckIns} isOwn={true} />
              : <GoalCard key={goal.id} goal={goal} checkIns={dayMy} allCheckIns={myCheckIns} isOwn={true} />
            )}
          </div>
          <div className="space-y-2">
            {buddyGoalList.map(goal => isToday
              ? <WeekSummaryCard key={goal.id} goal={goal} allCheckIns={buddyCheckIns} isOwn={false} />
              : <GoalCard key={goal.id} goal={goal} checkIns={dayBuddy} allCheckIns={buddyCheckIns} isOwn={false} />
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Banner */}
      <div
        className="rounded-2xl px-4 py-3 mb-4 text-white"
        style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => setDayOffset(o => Math.max(0, o - 1))}
            disabled={dayOffset === 0}
            className="w-8 h-8 flex items-center justify-center rounded-full transition disabled:opacity-30 hover:bg-white/20"
            aria-label="Previous day"
          >‹</button>
          <div className="text-center">
            <p className="font-black text-base">
              {isToday ? 'This Week' : DAY_NAMES[dayOffset]}
              {!isToday && isFuture && <span className="text-white/60 text-sm font-semibold"> · upcoming</span>}
            </p>
            <p className="text-white/70 text-xs font-semibold mt-0.5">
              {isToday ? 'Week to date' : `Day ${dayOffset + 1} of 7`}
            </p>
          </div>
          <button
            onClick={() => setDayOffset(o => Math.min(6, o + 1))}
            disabled={dayOffset === 6}
            className="w-8 h-8 flex items-center justify-center rounded-full transition disabled:opacity-30 hover:bg-white/20"
            aria-label="Next day"
          >›</button>
        </div>
      </div>

      {/* Score tiles */}
      <div className="grid grid-cols-2 gap-4 mb-4 select-none">
        {[
          { profile: myProfile, score: myScore, isWinner: !tied && iWon },
          { profile: buddyProfile, score: buddyScore, isWinner: !tied && !iWon },
        ].map(({ profile, score, isWinner }) => (
          <div
            key={profile?.id ?? 'buddy'}
            className="rounded-2xl p-4 text-center cursor-default"
            style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
          >
            {tileLabel(isWinner)}
            <p className="text-sm font-bold text-white/70">{profile?.name ?? 'Buddy'}</p>
            <p className="text-4xl font-black mt-1 text-white">{score}%</p>
            <p className="text-xs text-white/60 mt-1">this week</p>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {renderSection('Daily Goals', myDailyGoals, buddyDailyGoals)}
        {renderSection('Target Goals', myTargetGoals, buddyTargetGoals)}
        {renderSection('Milestones', myMilestoneGoals, buddyMilestoneGoals)}
      </div>

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
