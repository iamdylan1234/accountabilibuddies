'use client'

import { useEffect, useOptimistic, useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toggleCheckIn } from '@/app/dashboard/checkin-actions'
import GoalCard from './GoalCard'
import CumulativeCard from './CumulativeCard'
import type { Goal, CheckIn, Reaction, ChallengeWithProfiles, Profile } from '@/types/database'
import { isGoalCatchUp, getCurrentStreak } from '@/lib/scoring'

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

function EmptyColumn() {
  return (
    <div className="flex items-center justify-center rounded-xl px-4 py-3 border border-dashed border-gray-200 min-h-[46px]">
      <span className="text-xs text-gray-300 font-semibold">No goals</span>
    </div>
  )
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
  const [failedGoals, setFailedGoals] = useState<Set<string>>(new Set())

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
      const result = await toggleCheckIn(goalId, today)
      if (result?.error) {
        // Revert optimistic update
        applyOptimistic({ goalId, action: existing ? 'add' : 'remove' })
        setFailedGoals(prev => new Set([...prev, goalId]))
        setTimeout(() => setFailedGoals(prev => {
          const next = new Set(prev)
          next.delete(goalId)
          return next
        }), 3000)
      }
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

  function getRemaining(goal: Goal, checkIns: CheckIn[]): number | undefined {
    if (goal.type !== 'frequency' || goal.target_count == null) return undefined
    const done = checkIns.filter(c => c.goal_id === goal.id && c.completed).length
    return Math.max(0, goal.target_count - done)
  }

  function getReaction(checkInId: string | undefined) {
    if (!checkInId) return null
    return reactions.find(r => r.check_in_id === checkInId) ?? null
  }

  // Section 1: Today's Goals — daily goals + frequency goals scheduled today
  const myTodayGoals = myGoals.filter(g =>
    g.type === 'daily' ||
    (g.type === 'frequency' && g.schedule_dates?.includes(today))
  )
  const buddyTodayGoals = buddyGoals.filter(g =>
    g.type === 'daily' ||
    (g.type === 'frequency' && g.schedule_dates?.includes(today))
  )

  // Section 2: Optional — frequency (not scheduled today) + cumulative; catch-up rendered red
  const myOptionalGoals = myGoals.filter(g =>
    g.type === 'cumulative' ||
    (g.type === 'frequency' && !g.schedule_dates?.includes(today))
  )
  const buddyOptionalGoals = buddyGoals.filter(g =>
    g.type === 'cumulative' ||
    (g.type === 'frequency' && !g.schedule_dates?.includes(today))
  )

  // Section 3: Milestones
  const myMilestoneGoals = myGoals.filter(g => g.type === 'milestone')
  const buddyMilestoneGoals = buddyGoals.filter(g => g.type === 'milestone')

  // Score tiles: Today's Goals only (daily + frequency scheduled today)
  const myDone = myTodayGoals.filter(g => !!getCheckIn(g.id, optimisticCheckIns)).length
  const myTotal = myTodayGoals.length
  const buddyDone = buddyTodayGoals.filter(g => !!getCheckIn(g.id, buddyCheckIns)).length
  const buddyTotal = buddyTodayGoals.length

  const localDate = todayMidnight

  const todayTied = myDone === buddyDone
  const myAhead = !todayTied && myDone > buddyDone
  const buddyAhead = !todayTied && buddyDone > myDone
  const bothPerfect = myTotal > 0 && buddyTotal > 0 && myDone === myTotal && buddyDone === buddyTotal

  function tileLabel(isAhead: boolean) {
    if (bothPerfect) return <p className="text-xs font-black text-yellow-300 mb-1">🎉 Perfect!</p>
    if (isAhead) return <p className="text-xs font-black text-yellow-300 mb-1">⚡ AHEAD</p>
    if (todayTied) return <p className="text-xs font-black text-white/50 mb-1">💪 Keep Going</p>
    return <p className="text-xs mb-1">&nbsp;</p>
  }

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
            {tileLabel(isAhead)}
            <p className="text-sm font-bold text-white/70">{name}</p>
            <p className="text-4xl font-black mt-1 text-white">
              {total === 0 ? '—' : `${done}/${total}`}
            </p>
            <p className="text-xs text-white/60 mt-1">
              {total === 0 ? 'Rest day' : 'goals today'}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {/* Section 1: Today's Goals — daily + frequency scheduled today */}
        {(myTodayGoals.length > 0 || buddyTodayGoals.length > 0) && (
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">Today&apos;s Goals</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                {myTodayGoals.length === 0 ? <EmptyColumn /> : myTodayGoals.map(goal => (
                  <GoalCard key={goal.id} goal={goal}
                    checkIn={getCheckIn(goal.id, optimisticCheckIns)} reaction={null}
                    isMyGoal={true} today={today} onToggle={handleToggle}
                    streak={getCurrentStreak(goal, myCheckIns, today)}
                    remaining={getRemaining(goal, myCheckIns)}
                    hasFailed={failedGoals.has(goal.id)} />
                ))}
              </div>
              <div className="space-y-2">
                {buddyTodayGoals.length === 0 ? <EmptyColumn /> : buddyTodayGoals.map(goal => (
                  <GoalCard key={goal.id} goal={goal}
                    checkIn={getCheckIn(goal.id, buddyCheckIns)}
                    reaction={getReaction(getCheckIn(goal.id, buddyCheckIns)?.id)}
                    isMyGoal={false} today={today} onToggle={handleToggle}
                    streak={getCurrentStreak(goal, buddyCheckIns, today)}
                    remaining={getRemaining(goal, buddyCheckIns)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Optional — frequency (not scheduled) + cumulative; catch-up shown red */}
        {(myOptionalGoals.length > 0 || buddyOptionalGoals.length > 0) && (
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">Optional</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                {myOptionalGoals.length === 0 ? <EmptyColumn /> : myOptionalGoals.map(goal => goal.type === 'cumulative'
                  ? <CumulativeCard key={goal.id} goal={goal} checkIns={myCheckIns} today={today} isMyGoal={true} />
                  : <GoalCard key={goal.id} goal={goal}
                      checkIn={getCheckIn(goal.id, optimisticCheckIns)} reaction={null}
                      isMyGoal={true} today={today} onToggle={handleToggle}
                      streak={getCurrentStreak(goal, myCheckIns, today)}
                      isCatchUp={isGoalCatchUp(goal, today, optimisticCheckIns)}
                      remaining={getRemaining(goal, myCheckIns)}
                      hasFailed={failedGoals.has(goal.id)} />
                )}
              </div>
              <div className="space-y-2">
                {buddyOptionalGoals.length === 0 ? <EmptyColumn /> : buddyOptionalGoals.map(goal => {
                  const checkIn = getCheckIn(goal.id, buddyCheckIns)
                  return goal.type === 'cumulative'
                    ? <CumulativeCard key={goal.id} goal={goal} checkIns={buddyCheckIns} today={today} isMyGoal={false} />
                    : <GoalCard key={goal.id} goal={goal}
                        checkIn={checkIn}
                        reaction={getReaction(checkIn?.id)}
                        isMyGoal={false} today={today} onToggle={handleToggle}
                        streak={getCurrentStreak(goal, buddyCheckIns, today)}
                        isCatchUp={isGoalCatchUp(goal, today, buddyCheckIns)}
                        remaining={getRemaining(goal, buddyCheckIns)} />
                })}
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Milestones */}
        {(myMilestoneGoals.length > 0 || buddyMilestoneGoals.length > 0) && (
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">Milestones</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                {myMilestoneGoals.length === 0 ? <EmptyColumn /> : myMilestoneGoals.map(goal => (
                  <GoalCard key={goal.id} goal={goal}
                    checkIn={getCheckIn(goal.id, optimisticCheckIns)} reaction={null}
                    isMyGoal={true} today={today} onToggle={handleToggle}
                    hasFailed={failedGoals.has(goal.id)} />
                ))}
              </div>
              <div className="space-y-2">
                {buddyMilestoneGoals.length === 0 ? <EmptyColumn /> : buddyMilestoneGoals.map(goal => {
                  const checkIn = getCheckIn(goal.id, buddyCheckIns)
                  return <GoalCard key={goal.id} goal={goal} checkIn={checkIn}
                    reaction={getReaction(checkIn?.id)} isMyGoal={false} today={today}
                    onToggle={handleToggle} />
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
