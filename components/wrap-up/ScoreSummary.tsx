'use client'

import { useState } from 'react'
import type { Goal, CheckIn, Profile, GoalChangeRequest } from '@/types/database'
import { scoreChallenge, scoreGoal, getCurrentStreak, getMissedDays } from '@/lib/scoring'
import { formatDate } from '@/lib/dateUtils'
import Link from 'next/link'
import PendingApprovalBanner from './PendingApprovalBanner'
import GoalCalendarSheet from '@/components/shared/GoalCalendarSheet'
import ScoreTileGrid from '@/components/shared/ScoreTileGrid'
import GoalPairGrid from '@/components/shared/GoalPairGrid'
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
  isHistorical: boolean
  missedDays?: number
  onOpen: (target: SheetTarget) => void
}

function SummaryGoalCard({
  goal, checkIns, isOwn, totalDays, startDate, today, pendingRequests, isHistorical, missedDays, onOpen,
}: SummaryGoalCardProps) {
  const pct = Math.round(scoreGoal(goal, checkIns, totalDays, startDate, today, true) * 100)
  const isPending = !isHistorical && isOwn && pendingRequests.some(r => r.goal_id === goal.id)
  const streak = getCurrentStreak(goal, checkIns, today)
  const complete = pct === 100 && !isPending
  const isMissed = (missedDays ?? 0) > 0 && !complete && !isPending
  const showBar = goal.type !== 'milestone'
  const label = goal.type === 'milestone' ? (complete ? '✓ Done' : 'Not yet') : `${pct}%`

  // Days elapsed since challenge start (calendar days, capped at totalDays)
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  const daysElapsed = Math.min(
    Math.floor((Date.UTC(ty, tm - 1, td) - Date.UTC(sy, sm - 1, sd)) / 86400000) + 1,
    totalDays,
  )

  // Type-specific subscript (concrete progress counts)
  let subscript = ''
  if (goal.type === 'daily') {
    const completedPastDays = new Set(
      checkIns.filter(c => c.goal_id === goal.id && c.completed && c.date <= today).map(c => c.date),
    ).size
    subscript = `${completedPastDays} of ${daysElapsed} days done`
  } else if (goal.type === 'frequency') {
    const completedCount = checkIns.filter(c => c.goal_id === goal.id && c.completed).length
    const targetCount = goal.target_count ?? 0
    subscript = targetCount > 0
      ? `${completedCount} of ${targetCount} this month`
      : `${completedCount} this month`
  } else if (goal.type === 'cumulative') {
    const loggedTotal = checkIns
      .filter(c => c.goal_id === goal.id && c.value != null)
      .reduce((s, c) => s + (c.value ?? 0), 0)
    const targetCount = goal.target_count ?? 0
    const unit = goal.target_unit ? ` ${goal.target_unit}` : ''
    subscript = targetCount > 0
      ? `${loggedTotal} / ${targetCount}${unit}`
      : `${loggedTotal}${unit}`
  } else if (goal.type === 'milestone') {
    subscript = complete ? 'Done' : 'Pending'
  }

  // Flag wording: daily = "missed" (final), frequency = "late" (catch-up still possible)
  const flagLabel = goal.type === 'daily'
    ? (missedDays === 1 ? '1 day missed' : `${missedDays} days missed`)
    : (missedDays === 1 ? '1 day late' : `${missedDays} days late`)

  return (
    <button
      type="button"
      onClick={() => onOpen({ goal, checkIns, isOwn })}
      className={[
        'w-full text-left rounded-xl px-4 py-3 transition active:scale-95 hover:opacity-90',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400',
        isPending ? 'opacity-60 bg-gray-50 text-gray-400'
          : complete ? 'text-white'
          : 'bg-gray-50 text-gray-700',
      ].join(' ')}
      style={
        complete ? { background: BRAND_GRADIENT } :
        isMissed ? { borderLeft: '3px solid #fca5a5' } :
        {}
      }
    >
      {/* Title + % badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold flex-1 leading-tight">
          {goal.title}{isPending && <span className="ml-1 text-xs">⏳</span>}
        </span>
        <span className={`text-xs font-black flex-shrink-0 ${complete ? 'text-white/80' : 'text-teal-600'}`}>
          {label}
        </span>
      </div>

      {/* Subscript: type-specific progress count */}
      {subscript && (
        <p className={`text-xs mt-0.5 ${complete ? 'text-white/70' : 'text-gray-500'}`}>{subscript}</p>
      )}

      {/* Progress bar — always teal/white */}
      {showBar && (
        <div className={`mt-2 h-1 rounded-full overflow-hidden ${complete ? 'bg-white/30' : 'bg-gray-200'}`}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: complete ? 'rgba(255,255,255,0.7)' : BRAND_GRADIENT_H,
            }}
          />
        </div>
      )}

      {/* Footer: streak + missed/late flag */}
      {(streak >= 2 || isMissed) && (
        <div className="flex items-center justify-between mt-2 gap-2">
          {streak >= 2 ? (
            <p className={`text-xs font-bold ${complete ? 'text-white/70' : 'text-orange-400'}`}>🔥{streak}</p>
          ) : <span />}
          {isMissed && (
            <span className="text-xs font-black text-red-400 flex-shrink-0">{flagLabel}</span>
          )}
        </div>
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
  isHistorical?: boolean
  backHref?: string
}

export default function ScoreSummary({
  myGoals, buddyGoals, myCheckIns, buddyCheckIns,
  myProfile, buddyProfile, totalDays, challengeName, isComplete,
  startDate, endDate, today: serverToday, challengeId, myId, pendingRequests,
  isHistorical = false, backHref,
}: Props) {
  // For active challenges, recompute today in the user's local timezone.
  // The server passes UTC date which can be a day off for non-UTC users
  // (e.g. NZ at 7am local = 7pm previous day UTC) and undercounts missed days.
  // For historical views, the server passes end_date, which is correct as-is.
  const today = isHistorical ? serverToday : formatDate(new Date())
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
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm font-semibold text-gray-400 hover:text-gray-600 transition mb-4"
        >
          ← Back to profile
        </Link>
      )}
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

      {!isHistorical && (
        <PendingApprovalBanner
          requests={pendingRequests}
          goals={[...myGoals, ...buddyGoals]}
          myId={myId}
          myProfile={myProfile}
          buddyProfile={buddyProfile}
        />
      )}

      <div className="space-y-6">
        {/* Daily Goals */}
        {(myDailyGoals.length > 0 || buddyDailyGoals.length > 0) && (
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">Daily Goals</p>
            <GoalPairGrid
              myColumn={myDailyGoals.map(goal => (
                <SummaryGoalCard key={goal.id} goal={goal} checkIns={myCheckIns} isOwn={true}
                  totalDays={totalDays} startDate={startDate} today={today}
                  pendingRequests={pendingRequests} isHistorical={isHistorical}
                  missedDays={getMissedDays(goal, myCheckIns, today, startDate)}
                  onOpen={setSheet} />
              ))}
              buddyColumn={buddyDailyGoals.map(goal => (
                <SummaryGoalCard key={goal.id} goal={goal} checkIns={buddyCheckIns} isOwn={false}
                  totalDays={totalDays} startDate={startDate} today={today}
                  pendingRequests={pendingRequests} isHistorical={isHistorical}
                  missedDays={getMissedDays(goal, buddyCheckIns, today, startDate)}
                  onOpen={setSheet} />
              ))}
            />
          </div>
        )}

        {/* Ongoing */}
        {(myTargetGoals.length > 0 || buddyTargetGoals.length > 0) && (
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">Ongoing</p>
            <GoalPairGrid
              myColumn={myTargetGoals.map(goal => (
                <SummaryGoalCard key={goal.id} goal={goal} checkIns={myCheckIns} isOwn={true}
                  totalDays={totalDays} startDate={startDate} today={today}
                  pendingRequests={pendingRequests} isHistorical={isHistorical}
                  missedDays={getMissedDays(goal, myCheckIns, today, startDate)}
                  onOpen={setSheet} />
              ))}
              buddyColumn={buddyTargetGoals.map(goal => (
                <SummaryGoalCard key={goal.id} goal={goal} checkIns={buddyCheckIns} isOwn={false}
                  totalDays={totalDays} startDate={startDate} today={today}
                  pendingRequests={pendingRequests} isHistorical={isHistorical}
                  missedDays={getMissedDays(goal, buddyCheckIns, today, startDate)}
                  onOpen={setSheet} />
              ))}
            />
          </div>
        )}

        {/* Milestones */}
        {(myMilestoneGoals.length > 0 || buddyMilestoneGoals.length > 0) && (
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">Milestones</p>
            <GoalPairGrid
              myColumn={myMilestoneGoals.map(goal => (
                <SummaryGoalCard key={goal.id} goal={goal} checkIns={myCheckIns} isOwn={true}
                  totalDays={totalDays} startDate={startDate} today={today}
                  pendingRequests={pendingRequests} isHistorical={isHistorical} onOpen={setSheet} />
              ))}
              buddyColumn={buddyMilestoneGoals.map(goal => (
                <SummaryGoalCard key={goal.id} goal={goal} checkIns={buddyCheckIns} isOwn={false}
                  totalDays={totalDays} startDate={startDate} today={today}
                  pendingRequests={pendingRequests} isHistorical={isHistorical} onOpen={setSheet} />
              ))}
            />
          </div>
        )}
      </div>

      {isComplete && !isHistorical && (
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
          isPending={!isHistorical && sheet.isOwn && pendingRequests.some(r => r.goal_id === sheet.goal.id)}
          isHistorical={isHistorical}
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
