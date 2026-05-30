'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Profile, ChallengeWithProfiles, Goal, CheckIn } from '@/types/database'
import { getAvatarUrl } from '@/lib/avatar'
import { scoreChallenge } from '@/lib/scoring'
import { BRAND_GRADIENT } from '@/lib/brand'
import AvatarPicker from './AvatarPicker'
import StatTile from './StatTile'
import StreakDetailSheet from './StreakDetailSheet'
import ChallengeHistoryCard from './ChallengeHistoryCard'
import type { ProfileStats } from '@/app/profile/page'

interface Props {
  profile: Profile
  activeChallenge: ChallengeWithProfiles | null
  challenges: ChallengeWithProfiles[]
  allGoals: Goal[]
  allCheckIns: CheckIn[]
  stats: ProfileStats
  userId: string
}

function formatDateRange(start: string, end: string): string {
  const fmt = (d: string) => {
    const [y, m, day] = d.split('-').map(Number)
    return new Date(y, m - 1, day).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }
  return `${fmt(start)} – ${fmt(end)}`
}

export default function ProfileClient({
  profile, activeChallenge, challenges, allGoals, allCheckIns, stats, userId,
}: Props) {
  const [avatarStyle, setAvatarStyle] = useState(profile.avatar_style)
  const [showPicker, setShowPicker] = useState(false)
  const [showStreakSheet, setShowStreakSheet] = useState(false)
  const [showWinBreakdown, setShowWinBreakdown] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const avatarUrl = getAvatarUrl(userId, avatarStyle)

  const activeCardData = activeChallenge
    ? (() => {
        const start = new Date(activeChallenge.start_date)
        const today = new Date()
        const dayNumber = Math.max(
          1,
          Math.floor((today.getTime() - start.getTime()) / 86400000) + 1
        )
        const totalDays = Math.floor(
          (new Date(activeChallenge.end_date).getTime() - start.getTime()) / 86400000
        ) + 1
        return { name: activeChallenge.month_name, dayNumber, totalDays }
      })()
    : null

  const total = stats.wins + stats.losses + stats.ties
  const winRateDisplay = total === 0 ? '—' : `${Math.round((stats.wins / total) * 100)}%`
  const streakSubtitle = stats.bestStreak
    ? `${stats.bestStreak.goalTitle.slice(0, 12)} · ${stats.bestStreak.buddyName.split(' ')[0]}`
    : undefined

  // Build challenge history rows (most recent first — already ordered from RSC)
  const historyRows = challenges.map(challenge => {
    const buddyId = challenge.creator_id === userId ? challenge.buddy_id : challenge.creator_id
    const buddyProfile = challenge.creator_id === userId ? challenge.buddy : challenge.creator
    const buddyName = buddyProfile?.name ?? 'Buddy'

    const myGoals = allGoals.filter(g => g.challenge_id === challenge.id && g.user_id === userId)
    const buddyGoals = allGoals.filter(g => g.challenge_id === challenge.id && g.user_id === buddyId)
    const myCheckIns = allCheckIns.filter(c => c.user_id === userId && myGoals.some(g => g.id === c.goal_id))
    const buddyCheckIns = allCheckIns.filter(c => c.user_id === buddyId && buddyGoals.some(g => g.id === c.goal_id))

    const totalDays = Math.floor(
      (new Date(challenge.end_date).getTime() - new Date(challenge.start_date).getTime()) / 86400000
    ) + 1

    // For active challenges, score against today (not end_date which is in the future)
    const effectiveToday = challenge.status === 'active'
      ? new Date().toISOString().slice(0, 10)
      : challenge.end_date
    const myScore = scoreChallenge(myGoals, myCheckIns, totalDays, challenge.start_date, effectiveToday, true)
    const buddyScore = scoreChallenge(buddyGoals, buddyCheckIns, totalDays, challenge.start_date, effectiveToday, true)

    let result: 'win' | 'loss' | 'tie' | 'in-progress'
    if (challenge.status === 'active' || challenge.status === 'pending') result = 'in-progress'
    else if (myScore > buddyScore) result = 'win'
    else if (myScore < buddyScore) result = 'loss'
    else result = 'tie'

    return {
      challengeId: challenge.id,
      name: challenge.month_name,
      dateRange: formatDateRange(challenge.start_date, challenge.end_date),
      buddyName,
      myScore,
      buddyScore,
      result,
      status: challenge.status,
    }
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header with gear (links to /settings) */}
      <div className="relative">
        <Link
          href="/settings"
          aria-label="Settings"
          className="absolute top-0 right-0 p-2 -m-2 text-gray-400 hover:text-gray-600 transition active:scale-95"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </Link>

        {/* Avatar + name */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-100 shadow-sm hover:opacity-80 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            aria-label="Change avatar"
          >
            <img src={avatarUrl} alt="Your avatar" width={96} height={96} className="w-full h-full object-cover" />
          </button>
          <h1 className="text-xl font-black text-gray-800">{profile.name}</h1>
          {activeCardData ? (
            <Link
              href="/dashboard"
              className="block w-full mt-3 rounded-xl px-4 py-3 text-white shadow-sm active:scale-95 transition"
              style={{ background: BRAND_GRADIENT }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-left flex-1 min-w-0">
                  <p className="font-black text-base truncate">{activeCardData.name}</p>
                  <p className="text-xs text-white/75 font-semibold mt-0.5">
                    Day {activeCardData.dayNumber} of {activeCardData.totalDays}
                  </p>
                </div>
                <span className="text-white/80 text-lg font-bold flex-shrink-0">→</span>
              </div>
            </Link>
          ) : (
            <p className="text-sm text-gray-400 font-semibold">No active challenge</p>
          )}
          {avatarError && (
            <p className="text-xs text-red-500 font-semibold text-center mt-1">{avatarError}</p>
          )}
        </div>
      </div>

      {/* Stats — pill label + gray container, matching the section pattern from DashboardClient */}
      <section className="mb-6">
        <h2 className="w-full text-center bg-white text-gray-600 text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-full mb-2 border border-gray-200">
          Stats
        </h2>
        <div className="rounded-2xl bg-gray-100 p-3">
          <div className="grid grid-cols-4 gap-3">
            <StatTile value={String(stats.totalChallenges || '—')} label="completed" />

            <StatTile
              value={winRateDisplay}
              label="win rate"
              onClick={() => setShowWinBreakdown(v => !v)}
            >
              {showWinBreakdown && total > 0 && (
                <div className="rounded-xl bg-gray-50 px-3 py-2 text-center">
                  <div className="flex justify-around text-xs font-bold">
                    <span className="text-teal-500">{stats.wins}W</span>
                    <span className="text-red-400">{stats.losses}L</span>
                    <span className="text-gray-400">{stats.ties}T</span>
                  </div>
                </div>
              )}
            </StatTile>

            <StatTile
              value={stats.bestStreak ? `🔥${stats.bestStreak.days}` : '—'}
              label="best streak"
              subtitle={streakSubtitle}
              onClick={stats.bestStreak ? () => setShowStreakSheet(true) : undefined}
            />

            <StatTile value={String(stats.totalCheckIns || '—')} label="check-ins" />
          </div>
        </div>
      </section>

      {/* Challenge History — same pill + container pattern as Stats */}
      <section>
        <h2 className="w-full text-center bg-white text-gray-600 text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-full mb-2 border border-gray-200">
          Challenge History
        </h2>
        <div className="rounded-2xl bg-gray-100 p-3">
          {historyRows.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-6">
              No challenges yet
            </div>
          ) : (
            historyRows.map(row => (
              <ChallengeHistoryCard key={row.challengeId} {...row} />
            ))
          )}
        </div>
      </section>

      {/* Sheets */}
      {showPicker && (
        <AvatarPicker
          userId={userId}
          currentStyle={avatarStyle}
          onStyleChange={setAvatarStyle}
          onClose={() => setShowPicker(false)}
          onError={(msg) => {
            setAvatarError(msg)
            setTimeout(() => setAvatarError(null), 3000)
          }}
        />
      )}

      {showStreakSheet && stats.bestStreak && (
        <StreakDetailSheet
          best={stats.bestStreak}
          current={stats.currentStreak}
          onClose={() => setShowStreakSheet(false)}
        />
      )}
    </div>
  )
}
