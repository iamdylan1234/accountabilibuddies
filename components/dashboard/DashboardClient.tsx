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

  const todayTied = myDone === buddyDone
  const myAhead = !todayTied && myDone > buddyDone
  const buddyAhead = !todayTied && buddyDone > myDone

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Slim teal strip */}
      <div
        className="rounded-2xl px-5 py-3 mb-4 text-white"
        style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
      >
        <p className="font-black text-base">{challenge.month_name}</p>
        <p className="text-white/70 text-xs font-semibold mt-0.5">
          Day {dayNumber} of {totalDays} · {localDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Score tiles */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {[
          { name: 'You', done: myDone, total: myGoals.length, isAhead: myAhead },
          { name: buddy?.name ?? 'Buddy', done: buddyDone, total: buddyGoals.length, isAhead: buddyAhead },
        ].map(({ name, done, total, isAhead }) => (
          <div
            key={name}
            className="rounded-2xl border-2 p-4 text-center"
            style={{
              borderColor: isAhead ? '#F9F871' : '#e5e7eb',
              background: isAhead ? '#fffde7' : 'white',
            }}
          >
            {isAhead && <p className="text-xs font-black text-yellow-600 mb-1">⚡ AHEAD</p>}
            <p className="text-sm font-bold text-gray-500">{name}</p>
            <p className="text-4xl font-black mt-1" style={{ color: '#0077B6' }}>{done}/{total}</p>
            <p className="text-xs text-gray-400 mt-1">goals today</p>
          </div>
        ))}
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
  )
}
