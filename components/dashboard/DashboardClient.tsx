'use client'

import { useEffect, useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toggleCheckIn } from '@/app/dashboard/checkin-actions'
import GoalCard from './GoalCard'
import CumulativeCard from './CumulativeCard'
import type { Goal, CheckIn, Reaction, ChallengeWithProfiles, Profile } from '@/types/database'
import { isGoalActiveToday, isGoalCatchUp, getCurrentStreak } from '@/lib/scoring'

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
  const myProfile = (challenge.creator_id === myId ? challenge.creator : challenge.buddy) as Profile | null
  const myFirstName = myProfile?.name?.split(' ')[0] ?? 'there'
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
        value: null,
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

  // Section 1: goals due today (not catch-up, not milestone)
  const myTodayGoals = myGoals.filter(g =>
    g.type !== 'milestone' &&
    isGoalActiveToday(g, today, optimisticCheckIns) &&
    !isGoalCatchUp(g, today, optimisticCheckIns)
  )
  const buddyTodayGoals = buddyGoals.filter(g =>
    g.type !== 'milestone' &&
    isGoalActiveToday(g, today, buddyCheckIns) &&
    !isGoalCatchUp(g, today, buddyCheckIns)
  )

  // Section 2: milestones (always show)
  const myMilestoneGoals = myGoals.filter(g => g.type === 'milestone')
  const buddyMilestoneGoals = buddyGoals.filter(g => g.type === 'milestone')

  // Section 3: catch-up (overdue committed dates)
  const myCatchUpGoals = myGoals.filter(g => isGoalCatchUp(g, today, optimisticCheckIns))
  const buddyCatchUpGoals = buddyGoals.filter(g => isGoalCatchUp(g, today, buddyCheckIns))

  // Daily tile: only Section 1 goals count (exclude cumulative)
  const myDone = myTodayGoals
    .filter(g => g.type !== 'cumulative' && getCheckIn(g.id, optimisticCheckIns))
    .length
  const myTotal = myTodayGoals.filter(g => g.type !== 'cumulative').length
  const buddyDone = buddyTodayGoals
    .filter(g => g.type !== 'cumulative' && getCheckIn(g.id, buddyCheckIns))
    .length
  const buddyTotal = buddyTodayGoals.filter(g => g.type !== 'cumulative').length

  const localDate = todayMidnight

  const todayTied = myDone === buddyDone
  const myAhead = !todayTied && myDone > buddyDone
  const buddyAhead = !todayTied && buddyDone > myDone

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Slim teal strip */}
      <div
        className="rounded-2xl px-5 py-3 mb-4 text-white text-center"
        style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
      >
        <p className="font-black text-base">Hello, {myFirstName}</p>
        <p className="text-white/70 text-xs font-semibold mt-0.5">
          {localDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Score tiles */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {[
          { name: 'You', done: myDone, total: myTotal, isAhead: myAhead },
          { name: buddy?.name ?? 'Buddy', done: buddyDone, total: buddyTotal, isAhead: buddyAhead },
        ].map(({ name, done, total, isAhead }) => (
          <div
            key={name}
            className="rounded-2xl p-4 text-center"
            style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
          >
            {isAhead && <p className="text-xs font-black text-yellow-300 mb-1">⚡ AHEAD</p>}
            <p className="text-sm font-bold text-white/70">{name}</p>
            <p className="text-4xl font-black mt-1 text-white">{done}/{total}</p>
            <p className="text-xs text-white/60 mt-1">goals today</p>
          </div>
        ))}
      </div>


      <div className="space-y-6">
        {/* Section 1: Today's Goals */}
        {(myTodayGoals.length > 0 || buddyTodayGoals.length > 0) && (
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">Today&apos;s Goals</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                {myTodayGoals.map(goal => goal.type === 'cumulative'
                  ? <CumulativeCard key={goal.id} goal={goal} checkIns={myCheckIns} today={today} isMyGoal={true} />
                  : <GoalCard key={goal.id} goal={goal}
                      checkIn={getCheckIn(goal.id, optimisticCheckIns)} reaction={null}
                      isMyGoal={true} today={today} onToggle={handleToggle}
                      streak={getCurrentStreak(goal, myCheckIns, today)} />
                )}
              </div>
              <div className="space-y-2">
                {buddyTodayGoals.map(goal => goal.type === 'cumulative'
                  ? <CumulativeCard key={goal.id} goal={goal} checkIns={buddyCheckIns} today={today} isMyGoal={false} />
                  : <GoalCard key={goal.id} goal={goal}
                      checkIn={getCheckIn(goal.id, buddyCheckIns)}
                      reaction={getReaction(getCheckIn(goal.id, buddyCheckIns)?.id)}
                      isMyGoal={false} today={today} onToggle={handleToggle}
                      streak={getCurrentStreak(goal, buddyCheckIns, today)} />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Milestones */}
        {(myMilestoneGoals.length > 0 || buddyMilestoneGoals.length > 0) && (
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">Milestones</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                {myMilestoneGoals.map(goal => (
                  <GoalCard key={goal.id} goal={goal}
                    checkIn={getCheckIn(goal.id, optimisticCheckIns)} reaction={null}
                    isMyGoal={true} today={today} onToggle={handleToggle} />
                ))}
              </div>
              <div className="space-y-2">
                {buddyMilestoneGoals.map(goal => {
                  const checkIn = getCheckIn(goal.id, buddyCheckIns)
                  return <GoalCard key={goal.id} goal={goal} checkIn={checkIn}
                    reaction={getReaction(checkIn?.id)} isMyGoal={false} today={today}
                    onToggle={handleToggle} />
                })}
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Catch-up (overdue) */}
        {(myCatchUpGoals.length > 0 || buddyCatchUpGoals.length > 0) && (
          <div>
            <p className="text-xs font-black text-red-400 uppercase tracking-wide mb-2">🔴 Catch-up</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                {myCatchUpGoals.map(goal => (
                  <GoalCard key={goal.id} goal={goal}
                    checkIn={getCheckIn(goal.id, optimisticCheckIns)} reaction={null}
                    isMyGoal={true} today={today} onToggle={handleToggle}
                    isCatchUp={true} />
                ))}
              </div>
              <div className="space-y-2">
                {buddyCatchUpGoals.map(goal => {
                  const checkIn = getCheckIn(goal.id, buddyCheckIns)
                  return <GoalCard key={goal.id} goal={goal} checkIn={checkIn}
                    reaction={getReaction(checkIn?.id)} isMyGoal={false} today={today}
                    onToggle={handleToggle} isCatchUp={true} />
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
