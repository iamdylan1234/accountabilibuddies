'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import GoalCard from './GoalCard'
import WeeklyPlan from './WeeklyPlan'
import type { Goal, CheckIn, Reaction, ChallengeWithProfiles, Profile } from '@/types/database'

interface Props {
  challenge: ChallengeWithProfiles
  myGoals: Goal[]
  buddyGoals: Goal[]
  myCheckIns: CheckIn[]
  buddyCheckIns: CheckIn[]
  reactions: Reaction[]
  myId: string
  today: string
  dayNumber: number
  totalDays: number
}

export default function DashboardClient({
  challenge,
  myGoals,
  buddyGoals,
  myCheckIns,
  buddyCheckIns,
  reactions,
  myId,
  today,
  dayNumber,
  totalDays,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const buddy = (challenge.creator_id === myId ? challenge.buddy : challenge.creator) as Profile | null

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'check_ins',
      }, () => router.refresh())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reactions',
      }, () => router.refresh())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  function getCheckIn(goalId: string, checkIns: CheckIn[]) {
    return checkIns.find(c => c.goal_id === goalId && c.date === today) ?? null
  }

  function getReaction(checkInId: string | undefined) {
    if (!checkInId) return null
    return reactions.find(r => r.check_in_id === checkInId) ?? null
  }

  const myDone = myGoals.filter(g => getCheckIn(g.id, myCheckIns)).length
  const buddyDone = buddyGoals.filter(g => getCheckIn(g.id, buddyCheckIns)).length

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div
        className="rounded-2xl p-6 mb-6 text-white"
        style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
      >
        <p className="text-white/70 text-sm font-semibold uppercase tracking-wide">
          {challenge.month_name}
        </p>
        <h1 className="text-3xl font-black mt-1">Day {dayNumber} of {totalDays}</h1>
        <p className="text-white/60 text-sm mt-1">
          {new Date(today).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Sunday weekly plan */}
      {(() => {
        const [y, m, d] = today.split('-').map(Number)
        const todayDayOfWeek = new Date(y, m - 1, d).getDay()
        return todayDayOfWeek === 0
      })() && (
        <WeeklyPlan
          myGoals={myGoals}
          myCheckIns={myCheckIns}
          remainingWeeks={Math.max(1, Math.ceil((totalDays - dayNumber) / 7))}
          sundayDate={today}
          monthEndDate={challenge.end_date}
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="font-black text-gray-900">You</span>
            <span
              className="text-xs font-bold px-3 py-1 rounded-full text-white"
              style={{ background: '#F9F871', color: '#0077B6' }}
            >
              {myDone}/{myGoals.length} today
            </span>
          </div>
          <div className="space-y-2">
            {myGoals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                checkIn={getCheckIn(goal.id, myCheckIns)}
                reaction={null}
                isMyGoal={true}
                today={today}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="font-black text-gray-900">{buddy?.name ?? 'Buddy'}</span>
            <span
              className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: '#E8FBF7', color: '#00C9A7' }}
            >
              {buddyDone}/{buddyGoals.length} today
            </span>
          </div>
          <div className="space-y-2">
            {buddyGoals.map(goal => {
              const checkIn = getCheckIn(goal.id, buddyCheckIns)
              return (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  checkIn={checkIn}
                  reaction={getReaction(checkIn?.id)}
                  isMyGoal={false}
                  today={today}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
