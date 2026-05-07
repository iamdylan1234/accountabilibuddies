'use client'

import { useState } from 'react'
import type { Profile } from '@/types/database'
import { getAvatarUrl } from '@/lib/avatar'

interface Props {
  myProfile: Profile
  buddyProfile: Profile | null
  today: string
  onEditOpen: () => void
}

export default function BuddyMessageRow({ myProfile, buddyProfile, today, onEditOpen }: Props) {
  const [buddyExpanded, setBuddyExpanded] = useState(false)

  if (!buddyProfile) return null

  const myMessage = myProfile.message_date === today ? myProfile.daily_message : null
  const buddyMessage = buddyProfile.message_date === today ? buddyProfile.daily_message : null

  return (
    <div className="grid grid-cols-2 gap-3 items-stretch">
      {/* My column — tap to edit */}
      <button
        type="button"
        onClick={onEditOpen}
        className="bg-white rounded-xl px-3 py-2.5 text-left min-h-[44px] flex items-start gap-2.5 shadow-sm active:scale-95 hover:opacity-90 transition"
        style={{ borderLeft: '3px solid #00C9A7' }}
      >
        <img
          src={getAvatarUrl(myProfile.id, myProfile.avatar_style)}
          alt=""
          className="w-8 h-8 rounded-full flex-shrink-0 bg-gray-100 mt-0.5"
        />
        {myMessage
          ? <span className="text-sm text-gray-800 leading-snug line-clamp-2">{myMessage}</span>
          : <span className="text-sm text-gray-400 italic self-center">Add a message…</span>
        }
      </button>

      {/* Buddy column — tap to expand/collapse */}
      {buddyMessage ? (
        <button
          type="button"
          onClick={() => setBuddyExpanded(v => !v)}
          className="bg-white rounded-xl px-3 py-2.5 text-left min-h-[44px] flex items-start gap-2.5 shadow-sm active:scale-95 hover:opacity-90 transition"
          style={{ borderLeft: '3px solid #e5e7eb' }}
        >
          <img
            src={getAvatarUrl(buddyProfile.id, buddyProfile.avatar_style)}
            alt=""
            className="w-8 h-8 rounded-full flex-shrink-0 bg-gray-100 mt-0.5"
          />
          <span className={`text-sm text-gray-700 leading-snug ${buddyExpanded ? '' : 'line-clamp-2'}`}>
            {buddyMessage}
          </span>
        </button>
      ) : (
        <div />
      )}
    </div>
  )
}
