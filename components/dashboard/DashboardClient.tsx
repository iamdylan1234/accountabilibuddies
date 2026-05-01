'use client'

import { useEffect, useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toggleCheckIn } from '@/app/dashboard/checkin-actions'
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
  startDate: string
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
  startDate,
  totalDays,
}: Props) {
  // Compute today in the user's local timezone, not server UTC
  const now = new Date()
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')

  // dayNumber based on local today vs challenge start
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const startMidnight = new Date(sy, sm - 1, sd)
  const [ty, tm, td] = today.split('-').map(Number)
  const todayMidnight = new Date(ty, tm - 1, td)
  const dayNumber = Math.max(1, Math.floor((todayMidnight.getTime() - startMidnight.getTime()) / 86400000) + 1)
  const router = useRouter()
  const supabase = createClient()
  const buddy = (challenge.creator_id === myId ? challenge.buddy : challenge.creator) as Profile | null
  const [, startTransition] = useTransition()

  const [optimisticCheckIns, applyOptimistic] = useOptimistic(
    myCheckIns,
    (state: CheckIn[], { goalId, action }: { goalId: string; action: 'add' | 'remove' }) => {
      if (action === 'remove') {
        return state.filter(c => !(c.goal_id === goalId && c.date === today))
      }
      return [...state, {
        id: `optimistic-${goalId}`,
        goal_id: goalId,
        user_id: myId,
        date: today,
        completed: true,
        created_at: '',
      }]
    }
  )

  function handleToggle(goalId: string) {
    const existing = optimisticCheckIns.find(c => c.goal_id === goalId && c.date === today)
    startTransition(async () => {
      applyOptimistic({ goalId, action: existing ? 'remove' : 'add' })
      await toggleCheckIn(goalId, today)
    })
  }

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

  const myDone = myGoals.filter(g => getCheckIn(g.id, optimisticCheckIns)).length
  const buddyDone = buddyGoals.filter(g => getCheckIn(g.id, buddyCheckIns)).length

  const localDate = todayMidnight

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div
        className="rounded-2xl p-6 mb-6 text-white"
        style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
      >
        <h1 className="text-3xl font-black">{challenge.month_name}</h1>
        <p className="text-white/70 text-sm font-semibold mt-1">
          Day {dayNumber} of {totalDays} · {localDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Sunday weekly plan */}
      {localDate.getDay() === 0 && (
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
                checkIn={getCheckIn(goal.id, optimisticCheckIns)}
                reaction={null}
                isMyGoal={true}
                today={today}
                onToggle={handleToggle}
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
                  onToggle={handleToggle}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
