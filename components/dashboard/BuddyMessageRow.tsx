import type { Profile } from '@/types/database'
import { getAvatarUrl } from '@/lib/avatar'

interface Props {
  myProfile: Profile
  buddyProfile: Profile | null
  today: string
  onEditOpen: () => void
}

export default function BuddyMessageRow({ myProfile, buddyProfile, today, onEditOpen }: Props) {
  if (!buddyProfile) return null

  const myMessage = myProfile.message_date === today ? myProfile.daily_message : null
  const buddyMessage = buddyProfile.message_date === today ? buddyProfile.daily_message : null

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* My column — always shown, tappable */}
      <button
        type="button"
        onClick={onEditOpen}
        className="bg-white rounded-xl px-3 py-2.5 text-left min-h-[44px] flex items-center gap-2.5 shadow-sm active:scale-95 hover:opacity-90 transition"
        style={{ borderLeft: '3px solid #0d9488' }}
      >
        <img
          src={getAvatarUrl(myProfile.id, myProfile.avatar_style)}
          alt=""
          className="w-8 h-8 rounded-full flex-shrink-0 bg-gray-100"
        />
        {myMessage
          ? <span className="text-sm text-gray-800 leading-snug line-clamp-2">{myMessage}</span>
          : <span className="text-sm text-gray-400 italic">Add a message…</span>
        }
      </button>

      {/* Buddy column — only rendered when they have a message today */}
      {buddyMessage ? (
        <div
          className="bg-white rounded-xl px-3 py-2.5 min-h-[44px] flex items-center gap-2.5 shadow-sm"
          style={{ borderLeft: '3px solid #e5e7eb' }}
        >
          <img
            src={getAvatarUrl(buddyProfile.id, buddyProfile.avatar_style)}
            alt=""
            className="w-8 h-8 rounded-full flex-shrink-0 bg-gray-100"
          />
          <span className="text-sm text-gray-700 leading-snug line-clamp-2">{buddyMessage}</span>
        </div>
      ) : (
        <div />
      )}
    </div>
  )
}
