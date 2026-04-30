'use client'

import { useState } from 'react'
import { addReaction } from '@/app/dashboard/checkin-actions'

const EMOJIS = ['🔥', '💪', '👏', '❤️', '⚡']

interface Props {
  checkInId: string
  existingEmoji?: string
}

export default function ReactionPicker({ checkInId, existingEmoji }: Props) {
  const [open, setOpen] = useState(false)

  async function handlePick(emoji: string) {
    setOpen(false)
    await addReaction(checkInId, emoji)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-lg leading-none hover:scale-110 transition-transform"
      >
        {existingEmoji ?? '😊'}
      </button>
      {open && (
        <div className="absolute bottom-8 right-0 bg-white rounded-xl shadow-lg border border-gray-100 p-2 flex gap-1 z-10">
          {EMOJIS.map(e => (
            <button
              key={e}
              onClick={() => handlePick(e)}
              className="text-xl hover:scale-125 transition-transform p-1"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
