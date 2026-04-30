import type { Goal, CheckIn, Profile } from '@/types/database'
import { scoreChallenge, scoreGoal } from '@/lib/scoring'
import Link from 'next/link'

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
}

export default function ScoreSummary({
  myGoals, buddyGoals, myCheckIns, buddyCheckIns,
  myProfile, buddyProfile, totalDays, challengeName, isComplete,
}: Props) {
  const myScore = scoreChallenge(myGoals, myCheckIns, totalDays)
  const buddyScore = scoreChallenge(buddyGoals, buddyCheckIns, totalDays)
  const iWon = myScore > buddyScore
  const tied = myScore === buddyScore

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div
        className="rounded-2xl p-6 text-white mb-8"
        style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
      >
        <p className="text-white/70 text-sm font-semibold uppercase tracking-wide">
          {isComplete ? 'Final Results' : 'Week in Review'}
        </p>
        <h1 className="text-3xl font-black mt-1">{challengeName}</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
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
            {isWinner && <p className="text-xs font-black text-yellow-600 mb-1">🏆 WINNER</p>}
            <p className="text-sm font-bold text-gray-500">{profile?.name ?? 'Buddy'}</p>
            <p className="text-5xl font-black mt-2" style={{ color: '#0077B6' }}>{score}%</p>
          </div>
        ))}
      </div>

      {tied && (
        <p className="text-center text-gray-500 text-sm mb-6 font-semibold">It's a tie! 🤝</p>
      )}

      <h2 className="font-black text-gray-900 mb-3">Your goals this period</h2>
      <div className="space-y-2 mb-8">
        {myGoals.map(goal => {
          const pct = Math.round(scoreGoal(goal, myCheckIns, totalDays) * 100)
          return (
            <div key={goal.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">{goal.title}</p>
              </div>
              <div className="text-sm font-black" style={{ color: pct >= 80 ? '#00C9A7' : pct >= 50 ? '#0077B6' : '#ef4444' }}>
                {pct}%
              </div>
            </div>
          )
        })}
      </div>

      {isComplete && (
        <Link
          href="/dashboard"
          className="block w-full text-center py-3 rounded-xl font-bold text-sm"
          style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)', color: 'white' }}
        >
          Start a new challenge →
        </Link>
      )}
    </div>
  )
}
