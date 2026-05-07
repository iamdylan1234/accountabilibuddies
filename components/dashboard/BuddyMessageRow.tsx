import type { Profile } from '@/types/database'

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
    <div className="flex gap-3">
      {/* My column — tappable */}
      <button
        type="button"
        onClick={onEditOpen}
        className="flex-1 rounded-xl px-3 py-2.5 text-left min-h-[44px] flex items-center transition active:scale-95 hover:opacity-90 border border-teal-200 bg-teal-50"
      >
        {myMessage
          ? <span className="text-sm text-gray-800 leading-snug">{myMessage}</span>
          : <span className="text-sm text-teal-400 italic">Add a message…</span>
        }
      </button>

      {/* Buddy column — read-only */}
      <div className="flex-1 rounded-xl px-3 py-2.5 min-h-[44px] flex items-center border border-gray-200 bg-gray-50">
        {buddyMessage
          ? <span className="text-sm text-gray-700 leading-snug">{buddyMessage}</span>
          : null
        }
      </div>
    </div>
  )
}
