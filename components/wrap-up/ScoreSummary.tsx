'use client'

import { useState } from 'react'
import type { Goal, CheckIn, Profile, GoalChangeRequest } from '@/types/database'
import { scoreChallenge, scoreGoal, getCurrentStreak } from '@/lib/scoring'
import Link from 'next/link'
import PendingApprovalBanner from './PendingApprovalBanner'
import GoalCalendarSheet from '@/components/shared/GoalCalendarSheet'
import ScoreTileGrid from '@/components/shared/ScoreTileGrid'
import { BRAND_GRADIENT, BRAND_GRADIENT_H } from '@/lib/brand'

// ── Types ─────────────────────────────────────────────────────────────────────
type SheetTarget = { goal: Goal; checkIns: CheckIn[]; isOwn: boolean }

// ── Module-level sub-components ───────────────────────────────────────────────
interface SummaryGoalCardProps {
  goal: Goal
  checkIns: CheckIn[]
  isOwn: boolean
  totalDays: number
  startDate: string
  today: string
  pendingRequests: GoalChangeRequest[]
  onOpen: (target: SheetTarget) => void
}

function SummaryGoalCard({
  goal, checkIns, isOwn, totalDays, startDate, today, pendingRequests, onOpen,
}: SummaryGoalCardProps) {
  const pct = Math.round(scoreGoal(goal, checkIns, totalDays, startDate, today, true) * 100)
  const isPending = isOwn && pendingRequests.some(r => r.goal_id === goal.id)
  const streak = getCurrentStreak(goal, checkIns, today)

  return (
    <button
      type="button"
      className="w-full text-left rounded-xl border p-4 cursor-pointer active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
      style={isPending
        ? { background: '#f3f4f6', borderColor: '#e5e7eb' }
        : { background: 'white', borderColor: '#f3f4f6' }}
      onClick={() => onOpen({ goal, checkIns, isOwn })}
    >
      {/* Title row */}
      <div className="flex items-center gap-2 mb-2">
        <p className={`flex-1 text-sm font-bold ${isPending ? 'text-gray-400' : 'text-gray-800'}`}>
          {goal.title}
        </p>
        {isPending && <span className="text-xs text-gray-400">⏳</span>}
        <span className="text-sm font-black" style={{ color: isPending ? '#d1d5db' : '#0077B6' }}>
          {pct}%
        </span>
        <span className="text-gray-300 text-sm leading-none">›</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: isPending ? '#e5e7eb' : BRAND_GRADIENT_H }}
        />
      </div>

      {/* Footer: streak */}
      {streak >= 2 && (
        <p className="text-xs text-gray-400 mt-2">🔥{streak}</p>
      )}
    </button>
  )
}

interface Props {
  myGoals: Goal[]
  buddyGoals: Goal[]
  myCheckIns: CheckIn[]
  buddyCheckIns: CheckIn[]
  myProfile: Profile
  buddyProfile: Profile | null
  totalDays: number
  challengeName: string
  isComplete: boolean
  startDate: string
  endDate: string
  today: string
  challengeId: string
  myId: string
  pendingRequests: GoalChangeRequest[]
}

export default function ScoreSummary({
  myGoals, buddyGoals, myCheckIns, buddyCheckIns,
  myProfile, buddyProfile, totalDays, challengeName, isComplete,
  startDate, endDate, today, challengeId, myId, pendingRequests,
}: Props) {
  const myScore = scoreChallenge(myGoals, myCheckIns, totalDays, startDate, today, true)
  const buddyScore = scoreChallenge(buddyGoals, buddyCheckIns, totalDays, startDate, today, true)
  const iWon = myScore > buddyScore
  const tied = myScore === buddyScore
  const bothPerfect = myScore === 100 && buddyScore === 100

  // Section splits
  const myDailyGoals = myGoals.filter(g => g.type === 'daily')
  const buddyDailyGoals = buddyGoals.filter(g => g.type === 'daily')
  const myTargetGoals = myGoals.filter(g => g.type === 'frequency' || g.type === 'cumulative')
  const buddyTargetGoals = buddyGoals.filter(g => g.type === 'frequency' || g.type === 'cumulative')
  const myMilestoneGoals = myGoals.filter(g => g.type === 'milestone')
  const buddyMilestoneGoals = buddyGoals.filter(g => g.type === 'milestone')

  const [sheet, setSheet] = useState<SheetTarget | null>(null)

  const myDaysActive = new Set(myCheckIns.filter(c => c.completed).map(c => c.date)).size
  const buddyDaysActive = new Set(buddyCheckIns.filter(c => c.completed).map(c => c.date)).size

  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  const dayNumber = Math.max(1, Math.floor(
    (new Date(ty, tm - 1, td).getTime() - new Date(sy, sm - 1, sd).getTime()) / 86400000
  ) + 1)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Slim teal strip */}
      <div
        className="rounded-2xl px-5 py-3 mb-4 text-white text-center"
        style={{ background: BRAND_GRADIENT }}
      >
        <p className="font-black text-base">{challengeName}</p>
        <p className="text-white/70 text-xs font-semibold mt-0.5">
          Day {dayNumber} of {totalDays} · {isComplete ? 'Final Results' : 'Summary'}
        </p>
      </div>

      {/* Score tiles */}
      <ScoreTileGrid
        left={{
          name: myProfile?.name ?? 'Me',
          mainValue: `${myScore}%`,
          subLabel: `${myDaysActive}/${totalDays} days active`,
          isWinner: !tied && iWon,
        }}
        right={{
          name: buddyProfile?.name ?? 'Buddy',
          mainValue: `${buddyScore}%`,
          subLabel: `${buddyDaysActive}/${totalDays} days active`,
          isWinner: !tied && !iWon,
        }}
        tied={tied}
        bothPerfect={bothPerfect}
      />

      <PendingApprovalBanner
        requests={pendingRequests}
        goals={[...myGoals, ...buddyGoals]}
        myId={myId}
      />

      <div className="space-y-6">
        {/* Daily Goals */}
        {(myDailyGoals.length > 0 || buddyDailyGoals.length > 0) && (
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">Daily Goals</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                {myDailyGoals.map(goal => (
                  <SummaryGoalCard key={goal.id} goal={goal} checkIns={myCheckIns} isOwn={true}
                    totalDays={totalDays} startDate={startDate} today={today}
                    pendingRequests={pendingRequests} onOpen={setSheet} />
                ))}
              </div>
              <div className="space-y-2">
                {buddyDailyGoals.map(goal => (
                  <SummaryGoalCard key={goal.id} goal={goal} checkIns={buddyCheckIns} isOwn={false}
                    totalDays={totalDays} startDate={startDate} today={today}
                    pendingRequests={pendingRequests} onOpen={setSheet} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Target Goals */}
        {(myTargetGoals.length > 0 || buddyTargetGoals.length > 0) && (
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">Target Goals</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                {myTargetGoals.map(goal => (
                  <SummaryGoalCard key={goal.id} goal={goal} checkIns={myCheckIns} isOwn={true}
                    totalDays={totalDays} startDate={startDate} today={today}
                    pendingRequests={pendingRequests} onOpen={setSheet} />
                ))}
              </div>
              <div className="space-y-2">
                {buddyTargetGoals.map(goal => (
                  <SummaryGoalCard key={goal.id} goal={goal} checkIns={buddyCheckIns} isOwn={false}
                    totalDays={totalDays} startDate={startDate} today={today}
                    pendingRequests={pendingRequests} onOpen={setSheet} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Milestones */}
        {(myMilestoneGoals.length > 0 || buddyMilestoneGoals.length > 0) && (
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">Milestones</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                {myMilestoneGoals.map(goal => (
                  <SummaryGoalCard key={goal.id} goal={goal} checkIns={myCheckIns} isOwn={true}
                    totalDays={totalDays} startDate={startDate} today={today}
                    pendingRequests={pendingRequests} onOpen={setSheet} />
                ))}
              </div>
              <div className="space-y-2">
                {buddyMilestoneGoals.map(goal => (
                  <SummaryGoalCard key={goal.id} goal={goal} checkIns={buddyCheckIns} isOwn={false}
                    totalDays={totalDays} startDate={startDate} today={today}
                    pendingRequests={pendingRequests} onOpen={setSheet} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {isComplete && (
        <Link
          href="/dashboard"
          className="block w-full text-center py-3 rounded-xl font-bold text-sm mt-6"
          style={{ background: BRAND_GRADIENT, color: 'white' }}
        >
          Start a new challenge →
        </Link>
      )}

      {sheet && (
        <GoalCalendarSheet
          goal={sheet.goal}
          checkIns={sheet.checkIns}
          isOwn={sheet.isOwn}
          isPending={sheet.isOwn && pendingRequests.some(r => r.goal_id === sheet.goal.id)}
          startDate={startDate}
          endDate={endDate}
          today={today}
          challengeId={challengeId}
          myId={myId}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
