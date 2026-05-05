'use client'

import { Fragment } from 'react'
import GoalCard from './GoalCard'
import CumulativeCard from './CumulativeCard'
import ScoreTileGrid from '@/components/shared/ScoreTileGrid'
import { useDashboardRealtime } from './useDashboardRealtime'
import { useCheckInToggle } from './useCheckInToggle'
import type { Goal, CheckIn, Reaction, ChallengeWithProfiles, Profile } from '@/types/database'
import { isGoalCatchUp, getCurrentStreak } from '@/lib/scoring'
import type { ReactNode } from 'react'
import { BRAND_GRADIENT, BRAND_GRADIENT_H } from '@/lib/brand'
import { formatDate } from '@/lib/dateUtils'

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

// Renders two arrays as row-aligned pairs in a CSS grid so cards at the
// same index always sit in the same horizontal row.
function GoalPairGrid({ myColumn, buddyColumn }: { myColumn: ReactNode[]; buddyColumn: ReactNode[] }) {
  const maxLen = Math.max(myColumn.length, buddyColumn.length)
  if (maxLen === 0) return null
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      {Array.from({ length: maxLen }, (_, i) => (
        <Fragment key={i}>
          {i === 0 && myColumn.length === 0 ? <EmptyColumn /> : (myColumn[i] ?? <div />)}
          {i === 0 && buddyColumn.length === 0 ? <EmptyColumn /> : (buddyColumn[i] ?? <div />)}
        </Fragment>
      ))}
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
  const today = formatDate(now)
  const [ty, tm, td] = today.split('-').map(Number)
  const todayMidnight = new Date(ty, tm - 1, td)
  const buddy = (challenge.creator_id === myId ? challenge.buddy : challenge.creator) as Profile | null
  const myProfile = (challenge.creator_id === myId ? challenge.creator : challenge.buddy) as Profile | null
  const myFirstName = myProfile?.name?.split(' ')[0] ?? 'there'

  const { isRefreshing } = useDashboardRealtime(myId, buddy?.id)
  const { optimisticCheckIns, failedGoals, handleToggle } = useCheckInToggle(myCheckIns, myId, today)

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

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Slim teal strip */}
      <div
        className="rounded-2xl px-5 py-3 mb-2 text-white text-center"
        style={{ background: BRAND_GRADIENT }}
      >
        <p className="font-black text-base">Hello, {myFirstName}</p>
        <p className="text-white/70 text-xs font-semibold mt-0.5">
          {localDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Realtime refresh indicator — thin animated bar under header */}
      <div className={`h-0.5 rounded-full mb-3 overflow-hidden transition-opacity duration-300 ${isRefreshing ? 'opacity-100' : 'opacity-0'}`}>
        <div className="h-full w-full animate-pulse" style={{ background: BRAND_GRADIENT_H }} />
      </div>

      {/* Score tiles */}
      <ScoreTileGrid
        left={{
          name: myFirstName,
          mainValue: myTotal === 0 ? '—' : `${myDone}/${myTotal}`,
          subLabel: myTotal === 0 ? 'Rest day' : 'goals today',
          isWinner: myAhead,
          dimmed: isRefreshing,
        }}
        right={{
          name: buddy?.name ?? 'Buddy',
          mainValue: buddyTotal === 0 ? '—' : `${buddyDone}/${buddyTotal}`,
          subLabel: buddyTotal === 0 ? 'Rest day' : 'goals today',
          isWinner: buddyAhead,
          dimmed: isRefreshing,
        }}
        tied={todayTied}
        bothPerfect={bothPerfect}
      />

      <div className="space-y-6">
        {/* Section 1: Today's Goals — daily + frequency scheduled today */}
        {(myTodayGoals.length > 0 || buddyTodayGoals.length > 0) && (
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">Today&apos;s Goals</p>
            <GoalPairGrid
              myColumn={myTodayGoals.map(goal => (
                <GoalCard key={goal.id} goal={goal}
                  checkIn={getCheckIn(goal.id, optimisticCheckIns)} reaction={null}
                  isMyGoal={true} today={today} onToggle={handleToggle}
                  streak={getCurrentStreak(goal, myCheckIns, today)}
                  remaining={getRemaining(goal, myCheckIns)}
                  hasFailed={failedGoals.has(goal.id)} />
              ))}
              buddyColumn={buddyTodayGoals.map(goal => (
                <GoalCard key={goal.id} goal={goal}
                  checkIn={getCheckIn(goal.id, buddyCheckIns)}
                  reaction={getReaction(getCheckIn(goal.id, buddyCheckIns)?.id)}
                  isMyGoal={false} today={today} onToggle={handleToggle}
                  streak={getCurrentStreak(goal, buddyCheckIns, today)}
                  remaining={getRemaining(goal, buddyCheckIns)} />
              ))}
            />
          </div>
        )}

        {/* Section 2: Optional — frequency (not scheduled) + cumulative; catch-up shown red */}
        {(myOptionalGoals.length > 0 || buddyOptionalGoals.length > 0) && (
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">Optional</p>
            <GoalPairGrid
              myColumn={myOptionalGoals.map(goal => goal.type === 'cumulative'
                ? <CumulativeCard key={goal.id} goal={goal} checkIns={myCheckIns} today={today} isMyGoal={true} />
                : <GoalCard key={goal.id} goal={goal}
                    checkIn={getCheckIn(goal.id, optimisticCheckIns)} reaction={null}
                    isMyGoal={true} today={today} onToggle={handleToggle}
                    streak={getCurrentStreak(goal, myCheckIns, today)}
                    isCatchUp={isGoalCatchUp(goal, today, optimisticCheckIns)}
                    remaining={getRemaining(goal, myCheckIns)}
                    hasFailed={failedGoals.has(goal.id)} />
              )}
              buddyColumn={buddyOptionalGoals.map(goal => {
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
            />
          </div>
        )}

        {/* Section 3: Milestones */}
        {(myMilestoneGoals.length > 0 || buddyMilestoneGoals.length > 0) && (
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">Milestones</p>
            <GoalPairGrid
              myColumn={myMilestoneGoals.map(goal => (
                <GoalCard key={goal.id} goal={goal}
                  checkIn={getCheckIn(goal.id, optimisticCheckIns)} reaction={null}
                  isMyGoal={true} today={today} onToggle={handleToggle}
                  hasFailed={failedGoals.has(goal.id)} />
              ))}
              buddyColumn={buddyMilestoneGoals.map(goal => {
                const checkIn = getCheckIn(goal.id, buddyCheckIns)
                return <GoalCard key={goal.id} goal={goal} checkIn={checkIn}
                  reaction={getReaction(checkIn?.id)} isMyGoal={false} today={today}
                  onToggle={handleToggle} />
              })}
            />
          </div>
        )}
      </div>

      {/* Empty state — shown when no goals exist for today */}
      {myTodayGoals.length === 0 && myOptionalGoals.length === 0 && myMilestoneGoals.length === 0 &&
        buddyTodayGoals.length === 0 && buddyOptionalGoals.length === 0 && buddyMilestoneGoals.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">🎉</p>
          <p className="font-semibold text-sm">No goals today</p>
          <p className="text-xs mt-1">Enjoy the rest day</p>
        </div>
      )}
    </div>
  )
}
