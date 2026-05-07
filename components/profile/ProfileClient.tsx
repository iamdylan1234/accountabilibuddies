'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, ChallengeWithProfiles, Goal, CheckIn } from '@/types/database'
import { getAvatarUrl } from '@/lib/avatar'
import AvatarPicker from './AvatarPicker'
import StatTile from './StatTile'
import StreakDetailSheet from './StreakDetailSheet'
import type { ProfileStats } from '@/app/profile/page'

interface Props {
  profile: Profile
  activeChallenge: ChallengeWithProfiles | null
  challenges: ChallengeWithProfiles[]
  allGoals: Goal[]
  allCheckIns: CheckIn[]
  stats: ProfileStats
  avatarUrl: string
  userId: string
}

export default function ProfileClient({
  profile, activeChallenge, challenges, allGoals, allCheckIns, stats, userId,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [avatarStyle, setAvatarStyle] = useState(profile.avatar_style)
  const [showPicker, setShowPicker] = useState(false)
  const [showStreakSheet, setShowStreakSheet] = useState(false)
  const [showWinBreakdown, setShowWinBreakdown] = useState(false)

  const avatarUrl = getAvatarUrl(userId, avatarStyle)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const activeLine = activeChallenge
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
        return `Day ${dayNumber} of ${totalDays} · ${activeChallenge.month_name}`
      })()
    : 'No active challenge'

  const total = stats.wins + stats.losses + stats.ties
  const winRateDisplay = total === 0 ? '—' : `${Math.round((stats.wins / total) * 100)}%`

  const streakSubtitle = stats.bestStreak
    ? `${stats.bestStreak.goalTitle.slice(0, 12)} · ${stats.bestStreak.buddyName.split(' ')[0]}`
    : undefined

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
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
        <p className="text-sm text-gray-400 font-semibold">{activeLine}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {/* Tile 1: Challenges */}
        <StatTile
          value={String(stats.totalChallenges || '—')}
          label="challenges"
        />

        {/* Tile 2: Win Rate */}
        <StatTile
          value={winRateDisplay}
          label="win rate"
          onClick={() => setShowWinBreakdown(v => !v)}
        >
          {showWinBreakdown && total > 0 && (
            <div className="rounded-xl bg-gray-50 px-3 py-2 text-center col-span-1">
              <div className="flex justify-around text-xs font-bold">
                <span className="text-teal-500">{stats.wins}W</span>
                <span className="text-red-400">{stats.losses}L</span>
                <span className="text-gray-400">{stats.ties}T</span>
              </div>
            </div>
          )}
        </StatTile>

        {/* Tile 3: Best Streak */}
        <StatTile
          value={stats.bestStreak ? `🔥${stats.bestStreak.days}` : '—'}
          label="best streak"
          subtitle={streakSubtitle}
          onClick={stats.bestStreak ? () => setShowStreakSheet(true) : undefined}
        />

        {/* Tile 4: Check-ins */}
        <StatTile
          value={String(stats.totalCheckIns || '—')}
          label="check-ins"
        />
      </div>

      {/* History placeholder */}
      <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-3">
        Challenge History
      </p>
      <div className="rounded-2xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
        Loading history…
      </div>

      {/* Sign out */}
      <div className="mt-12 flex justify-center">
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-400 font-semibold hover:text-gray-600 transition"
        >
          Sign out
        </button>
      </div>

      {/* Sheets */}
      {showPicker && (
        <AvatarPicker
          userId={userId}
          currentStyle={avatarStyle}
          onStyleChange={setAvatarStyle}
          onClose={() => setShowPicker(false)}
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
