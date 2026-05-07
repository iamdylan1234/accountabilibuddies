'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, ChallengeWithProfiles } from '@/types/database'
import { getAvatarUrl } from '@/lib/avatar'
import AvatarPicker from './AvatarPicker'

interface Props {
  profile: Profile
  activeChallenge: ChallengeWithProfiles | null
  avatarUrl: string
}

export default function ProfileClient({ profile, activeChallenge, avatarUrl: _initialAvatarUrl }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [avatarStyle, setAvatarStyle] = useState(profile.avatar_style)
  const [showPicker, setShowPicker] = useState(false)

  const avatarUrl = getAvatarUrl(profile.id, avatarStyle)

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
          <img
            src={avatarUrl}
            alt="Your avatar"
            width={96}
            height={96}
            className="w-full h-full object-cover"
          />
        </button>
        <h1 className="text-xl font-black text-gray-800">{profile.name}</h1>
        <p className="text-sm text-gray-400 font-semibold">{activeLine}</p>
      </div>

      {/* Stats placeholder */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {['challenges', 'win rate', 'streak', 'check-ins'].map(label => (
          <div key={label} className="rounded-2xl bg-gray-50 px-2 py-4 text-center">
            <div className="h-5 w-8 bg-gray-200 rounded mx-auto mb-1 animate-pulse" />
            <p className="text-xs text-gray-400 font-semibold">{label}</p>
          </div>
        ))}
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

      {/* Avatar picker sheet */}
      {showPicker && (
        <AvatarPicker
          userId={profile.id}
          currentStyle={avatarStyle}
          onStyleChange={setAvatarStyle}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}
