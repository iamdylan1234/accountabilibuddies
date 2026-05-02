'use client'

import { useState } from 'react'
import { getWeekStart, scoreChallenge, scoreGoal, getCurrentStreak } from '@/lib/scoring'
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

  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  function goalLabel(goal: Goal, checkIns: CheckIn[]) {
    const relevant = checkIns.filter(c => c.goal_id === goal.id && c.completed)
    if (goal.type === 'daily') return relevant.length > 0 ? 'Done ✓' : isFuture ? 'Upcoming' : 'Not done'
    if (goal.type === 'milestone') return relevant.length > 0 ? 'Done ✓' : 'Not yet'
    if (goal.type === 'frequency') {
      const scheduledToday = goal.schedule_dates?.includes(selectedStr)
      if (scheduledToday) return relevant.length > 0 ? 'Done ✓' : isFuture ? 'Scheduled' : 'Not done'
      return goal.schedule_dates ? 'Not scheduled today' : (relevant.length > 0 ? 'Done ✓' : 'Not done')
    }
    if (goal.type === 'cumulative') {
      const total = checkIns.filter(c => c.goal_id === goal.id && c.value != null).reduce((s, c) => s + (c.value ?? 0), 0)
      return total > 0 ? `+${total}${goal.target_unit ? ' ' + goal.target_unit : ''} today` : isFuture ? 'Upcoming' : 'Nothing logged'
    }
    return ''
  }

  function GoalCard({ goal, checkIns }: { goal: Goal; checkIns: CheckIn[] }) {
    const relevant = checkIns.filter(c => c.goal_id === goal.id && c.completed)
    const doneToday = relevant.length > 0
    const scheduled = !goal.schedule_dates || goal.schedule_dates.length === 0 || goal.schedule_dates.includes(selectedStr)
    const streak = getCurrentStreak(goal, goal.user_id === myProfile.id ? myCheckIns : buddyCheckIns, isFuture ? todayStr : selectedStr)

    // Weekly progress % — uses full week's check-ins, scoped to Mon–today
    const ownerCheckIns = goal.user_id === myProfile.id ? myCheckIns : buddyCheckIns
    const weekGoalCheckIns = ownerCheckIns.filter(c => {
      if (c.goal_id !== goal.id) return false
      if (goal.type === 'milestone') return c.date <= todayStr
      return c.date >= weekStartStr && c.date <= todayStr
    })
    const pct = Math.round(scoreGoal(goal, weekGoalCheckIns, 7, weekStartStr, todayStr) * 100)

    if (!scheduled && goal.type === 'frequency') {
      return (
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 opacity-50">
          <p className="text-sm font-bold text-gray-400">{goal.title}</p>
          <p className="text-xs text-gray-300 mt-1">Not scheduled</p>
        </div>
      )
    }

    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-2">
          <p className="flex-1 text-sm font-bold text-gray-800">{goal.title}</p>
          {streak >= 2 && <span className="text-xs font-bold text-orange-400">🔥{streak}</span>}
          {doneToday && goal.type !== 'cumulative' && (
            <span className="text-xs font-bold" style={{ color: '#00C9A7' }}>✓ today</span>
          )}
          <span
            className="text-sm font-black"
            style={{ color: pct >= 80 ? '#00C9A7' : pct >= 50 ? '#0077B6' : '#ef4444' }}
          >
            {pct}%
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #00C9A7, #0077B6)' }}
          />
        </div>
        {isFuture && (
          <p className="text-xs text-blue-400 mt-1">{goalLabel(goal, checkIns)}</p>
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
            className="rounded-2xl border-2 p-5 text-center"
            style={{
              borderColor: isWinner ? '#F9F871' : '#e5e7eb',
              background: isWinner ? '#fffde7' : 'white',
            }}
          >
            {isWinner && <p className="text-xs font-black text-yellow-600 mb-1">🏆 WINNING</p>}
            <p className="text-sm font-bold text-gray-500">{profile?.name ?? 'Buddy'}</p>
            <p className="text-4xl font-black mt-1" style={{ color: '#0077B6' }}>{score}%</p>
            <p className="text-xs text-gray-400 mt-1">this week</p>
          </div>
        ))}
      </div>

      {tied && <p className="text-center text-gray-500 text-sm mb-6 font-semibold">Tied so far! 🤝</p>}

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
