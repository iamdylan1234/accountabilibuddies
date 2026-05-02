'use client'

import { useState } from 'react'
import { getWeekStart, scoreChallenge, getCurrentStreak } from '@/lib/scoring'
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
  totalDays: number
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
  myProfile, buddyProfile, challengeName, startDate, totalDays,
}: Props) {
  const now = new Date()
  const todayStr = fmt(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  const currentWeekStart = getWeekStart(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  const weekStartStr = fmt(currentWeekStart)

  // dayOffset: 0 = Monday … 6 = Sunday; default to today
  const todayOffset = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - currentWeekStart.getTime()) / 86400000
  )
  const [dayOffset, setDayOffset] = useState(todayOffset)

  const selectedDate = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate() + dayOffset)
  const selectedStr = fmt(selectedDate)
  const isToday = selectedStr === todayStr
  const isFuture = selectedStr > todayStr

  // Goal cards show the selected day only
  const dayMy = myCheckIns.filter(c => c.date === selectedStr)
  const dayBuddy = buddyCheckIns.filter(c => c.date === selectedStr)

  // Score tiles: scope check-ins to Mon–today for this week.
  // Milestones are one-time achievements — include them regardless of which week they were completed.
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

  // scoreGoal now uses startDate as the lower bound for schedule_dates,
  // so frequency denominators are scoped to this week too.
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

  function GoalCard({ goal, checkIns }: { goal: Goal; checkIns: CheckIn[] }) {
    // checkIns = day-filtered (selected day only)
    const relevant = checkIns.filter(c => c.goal_id === goal.id && c.completed)
    const done = relevant.length > 0
    const scheduled = !goal.schedule_dates || goal.schedule_dates.length === 0 || goal.schedule_dates.includes(selectedStr)
    const streak = getCurrentStreak(goal, goal.user_id === myProfile.id ? myCheckIns : buddyCheckIns, isFuture ? todayStr : selectedStr)

    // Not scheduled today — dim card, no checkbox
    if (!scheduled && goal.type === 'frequency') {
      return (
        <div className="w-full flex items-center gap-3 rounded-xl px-4 py-3 bg-gray-50 opacity-40">
          <span className="w-5 h-5 rounded-full border-2 border-gray-200 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-400 flex-1">{goal.title}</span>
        </div>
      )
    }

    // Cumulative: show logged value as subtitle instead of a checkbox
    if (goal.type === 'cumulative') {
      const total = checkIns.filter(c => c.goal_id === goal.id && c.value != null).reduce((s, c) => s + (c.value ?? 0), 0)
      const cardStyle = done
        ? { background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }
        : isFuture ? { background: '#f0f9ff', border: '1px solid #bae6fd' }
        : { background: '#f9fafb' }
      return (
        <div className="rounded-xl px-4 py-3" style={cardStyle}>
          <p className={`text-sm font-semibold ${done ? 'text-white' : isFuture ? 'text-blue-700' : 'text-gray-700'}`}>
            {goal.title}
          </p>
          <p className={`text-xs mt-0.5 ${done ? 'text-white/70' : isFuture ? 'text-blue-400' : 'text-gray-400'}`}>
            {total > 0 ? `+${total}${goal.target_unit ? ' ' + goal.target_unit : ''}` : isFuture ? 'Upcoming' : 'Nothing logged'}
          </p>
        </div>
      )
    }

    // Daily / milestone / frequency — Today tab style (read-only)
    const cardStyle = done
      ? { background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }
      : isFuture ? { background: '#f0f9ff', border: '1px solid #bae6fd' }
      : { background: '#f9fafb' }

    return (
      <div className="w-full flex items-center gap-3 rounded-xl px-4 py-3" style={cardStyle}>
        <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
          done ? 'border-white bg-white/30' : isFuture ? 'border-blue-300' : 'border-gray-300'
        }`}>
          {done && <span className="text-white text-xs font-bold">✓</span>}
        </span>
        <span className={`text-sm font-semibold flex-1 ${done ? 'text-white' : isFuture ? 'text-blue-700' : 'text-gray-700'}`}>
          {goal.title}
        </span>
        {streak >= 2 && (
          <span className={`text-xs font-bold ${done ? 'text-white/80' : 'text-orange-400'}`}>🔥{streak}</span>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Banner with day navigation arrows */}
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
          >
            ‹
          </button>
          <div className="text-center">
            <p className="font-black text-base">
              {isToday ? 'Today' : DAY_NAMES[dayOffset]}
              {isFuture && <span className="text-white/60 text-sm font-semibold"> · upcoming</span>}
            </p>
            <p className="text-white/70 text-xs font-semibold mt-0.5">
              {selectedDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long' })} · Week day {dayOffset + 1} of 7
            </p>
          </div>
          <button
            onClick={() => setDayOffset(o => Math.min(6, o + 1))}
            disabled={dayOffset === 6}
            className="w-8 h-8 flex items-center justify-center rounded-full transition disabled:opacity-30 hover:bg-white/20"
            aria-label="Next day"
          >
            ›
          </button>
        </div>
      </div>

      {/* Score tiles — this week's progress */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {[
          { profile: myProfile, score: myScore, isWinner: !tied && iWon },
          { profile: buddyProfile, score: buddyScore, isWinner: !tied && !iWon },
        ].map(({ profile, score, isWinner }) => (
          <div
            key={profile?.id ?? 'buddy'}
            className="rounded-2xl p-4 text-center"
            style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
          >
            {tileLabel(isWinner)}
            <p className="text-sm font-bold text-white/70">{profile?.name ?? 'Buddy'}</p>
            <p className="text-4xl font-black mt-1 text-white">{score}%</p>
            <p className="text-xs text-white/60 mt-1">this week</p>
          </div>
        ))}
      </div>

      {/* Two-column goal cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {myGoals.map(goal => (
            <GoalCard key={goal.id} goal={goal} checkIns={dayMy} />
          ))}
        </div>
        <div className="space-y-2">
          {buddyGoals.map(goal => (
            <GoalCard key={goal.id} goal={goal} checkIns={dayBuddy} />
          ))}
        </div>
      </div>
    </div>
  )
}
