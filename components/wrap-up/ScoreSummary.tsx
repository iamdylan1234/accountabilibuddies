import type { Goal, CheckIn, Profile, GoalChangeRequest } from '@/types/database'
import { scoreChallenge, scoreGoal } from '@/lib/scoring'
import Link from 'next/link'
import GoalEditButton from './GoalEditButton'
import PendingApprovalBanner from './PendingApprovalBanner'

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
  const myScore = scoreChallenge(myGoals, myCheckIns, totalDays, startDate, today)
  const buddyScore = scoreChallenge(buddyGoals, buddyCheckIns, totalDays, startDate, today)
  const iWon = myScore > buddyScore
  const tied = myScore === buddyScore

  const myDaysActive = new Set(myCheckIns.filter(c => c.completed).map(c => c.date)).size
  const buddyDaysActive = new Set(buddyCheckIns.filter(c => c.completed).map(c => c.date)).size

  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  const dayNumber = Math.max(1, Math.floor(
    (new Date(ty, tm - 1, td).getTime() - new Date(sy, sm - 1, sd).getTime()) / 86400000
  ) + 1)

  function GoalCard({ goal, checkIns, isOwn }: { goal: Goal; checkIns: CheckIn[]; isOwn: boolean }) {
    const denominator = goal.schedule_dates && goal.schedule_dates.length > 0
      ? goal.schedule_dates.filter(d => d <= today).length
      : totalDays
    const pct = denominator === 0 ? 0 : Math.round(scoreGoal(goal, checkIns, denominator, startDate, today) * 100)
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-2">
          <p className="flex-1 text-sm font-bold text-gray-800">{goal.title}</p>
          {isOwn && <GoalEditButton goal={goal} challengeId={challengeId} challengeStartDate={startDate} challengeEndDate={endDate} myId={myId} />}
          {isOwn && pendingRequests.some(r => r.goal_id === goal.id) && (
            <span className="text-xs text-yellow-500 font-bold">⏳</span>
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
        <p className="font-black text-base">{challengeName}</p>
        <p className="text-white/70 text-xs font-semibold mt-0.5">
          Day {dayNumber} of {totalDays} · {isComplete ? 'Final Results' : 'Summary'}
        </p>
      </div>

      <PendingApprovalBanner
        requests={pendingRequests}
        goals={[...myGoals, ...buddyGoals]}
        myId={myId}
      />

      {/* Score tiles */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {[
          { profile: myProfile, score: myScore, daysActive: myDaysActive, isWinner: !tied && iWon },
          { profile: buddyProfile, score: buddyScore, daysActive: buddyDaysActive, isWinner: !tied && !iWon },
        ].map(({ profile, score, daysActive, isWinner }) => (
          <div
            key={profile?.id ?? 'buddy'}
            className="rounded-2xl border-2 p-5 text-center"
            style={{
              borderColor: isWinner ? '#F9F871' : '#e5e7eb',
              background: isWinner ? '#fffde7' : 'white',
            }}
          >
            {isWinner && (
              <p className="text-xs font-black text-yellow-600 mb-1">
                {isComplete ? '🏆 WINNER' : '🏆 WINNING'}
              </p>
            )}
            <p className="text-sm font-bold text-gray-500">{profile?.name ?? 'Buddy'}</p>
            <p className="text-4xl font-black mt-1" style={{ color: '#0077B6' }}>{score}%</p>
            <p className="text-xs text-gray-400 mt-1">{daysActive}/{totalDays} days active</p>
          </div>
        ))}
      </div>

      {tied && (
        <p className="text-center text-gray-500 text-sm mb-6 font-semibold">It's a tie! 🤝</p>
      )}

      {/* Two-column goal cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {myGoals.map(goal => (
            <GoalCard key={goal.id} goal={goal} checkIns={myCheckIns} isOwn={true} />
          ))}
        </div>

        <div className="space-y-2">
          {buddyGoals.map(goal => (
            <GoalCard key={goal.id} goal={goal} checkIns={buddyCheckIns} isOwn={false} />
          ))}
        </div>
      </div>

      {isComplete && (
        <Link
          href="/dashboard"
          className="block w-full text-center py-3 rounded-xl font-bold text-sm mt-6"
          style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)', color: 'white' }}
        >
          Start a new challenge →
        </Link>
      )}
    </div>
  )
}
