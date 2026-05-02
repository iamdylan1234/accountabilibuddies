'use client'

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
}

export default function WeekView({
  myGoals, buddyGoals, myCheckIns, buddyCheckIns,
  myProfile, buddyProfile, challengeName,
}: Props) {
  // Compute today and weekStart in user's local timezone
  const now = new Date()
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')

  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = getWeekStart(todayMidnight)
  const weekStartStr = [
    weekStart.getFullYear(),
    String(weekStart.getMonth() + 1).padStart(2, '0'),
    String(weekStart.getDate()).padStart(2, '0'),
  ].join('-')

  // Days elapsed since Monday (1 on Monday, 7 on Sunday)
  const daysElapsed = Math.floor((todayMidnight.getTime() - weekStart.getTime()) / 86400000) + 1

  // Slice check-ins to Mon–today only
  const weekMy = myCheckIns.filter(c => c.date >= weekStartStr && c.date <= today)
  const weekBuddy = buddyCheckIns.filter(c => c.date >= weekStartStr && c.date <= today)

  const myScore = scoreChallenge(myGoals, weekMy, daysElapsed, weekStartStr, today)
  const buddyScore = scoreChallenge(buddyGoals, weekBuddy, daysElapsed, weekStartStr, today)
  const iWon = myScore > buddyScore
  const tied = myScore === buddyScore

  function goalLabel(goal: Goal, checkIns: CheckIn[]) {
    const relevant = checkIns.filter(c => c.goal_id === goal.id && c.completed)
    if (goal.type === 'daily') return `${relevant.length}/${daysElapsed} days`
    if (goal.type === 'milestone') return relevant.length > 0 ? 'Done ✓' : 'Not yet'
    if (goal.type === 'frequency') {
      const weekDates = goal.schedule_dates
        ? goal.schedule_dates.filter(d => d >= weekStartStr && d <= today).length
        : Math.round((goal.target_count ?? 1) / 4)
      return `${relevant.length}/${weekDates} this week`
    }
    return ''
  }

  function GoalCard({ goal, checkIns }: { goal: Goal; checkIns: CheckIn[] }) {
    const denominator = goal.schedule_dates && goal.schedule_dates.length > 0
      ? goal.schedule_dates.filter(d => d >= weekStartStr && d <= today).length
      : daysElapsed
    const pct = denominator === 0 ? 0 : Math.round(scoreGoal(goal, checkIns, denominator) * 100)
    const streak = getCurrentStreak(goal, checkIns, today)
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-1">
          <p className="flex-1 text-sm font-bold text-gray-800">{goal.title}</p>
          {streak >= 2 && <span className="text-xs font-bold text-orange-400">🔥{streak}</span>}
          <span className="text-sm font-black" style={{ color: '#0077B6' }}>{pct}%</span>
        </div>
        <p className="text-xs text-gray-400 mb-2">{goalLabel(goal, checkIns)}</p>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #00C9A7, #0077B6)' }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Slim teal strip */}
      <div
        className="rounded-2xl px-5 py-3 mb-4 text-white"
        style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
      >
        <p className="font-black text-base">This Week</p>
        <p className="text-white/70 text-xs font-semibold mt-0.5">
          {weekStart.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}–{new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} · Day {daysElapsed} of 7
        </p>
      </div>

      {/* Score tiles */}
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
            {isWinner && (
              <p className="text-xs font-black text-yellow-600 mb-1">🏆 WINNING</p>
            )}
            <p className="text-sm font-bold text-gray-500">{profile?.name ?? 'Buddy'}</p>
            <p className="text-4xl font-black mt-1" style={{ color: '#0077B6' }}>{score}%</p>
          </div>
        ))}
      </div>

      {tied && (
        <p className="text-center text-gray-500 text-sm mb-6 font-semibold">Tied so far! 🤝</p>
      )}

      {/* Two-column goal cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {myGoals.map(goal => (
            <GoalCard key={goal.id} goal={goal} checkIns={weekMy} />
          ))}
        </div>

        <div className="space-y-2">
          {buddyGoals.map(goal => (
            <GoalCard key={goal.id} goal={goal} checkIns={weekBuddy} />
          ))}
        </div>
      </div>
    </div>
  )
}
