'use client'

import { useState, useEffect, useRef } from 'react'
import { addReaction } from '@/app/dashboard/checkin-actions'

const EMOJIS = ['🔥', '💪', '👏', '❤️', '⚡']

interface Props {
  checkInId: string
  existingEmoji?: string
}

export default function ReactionPicker({ checkInId, existingEmoji }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [open])

  async function handlePick(emoji: string) {
    setOpen(false)
    await addReaction(checkInId, emoji)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`leading-none transition-transform hover:scale-110 ${existingEmoji ? 'text-lg' : 'text-white/50 text-sm font-black'}`}
        aria-label={existingEmoji ? 'Change reaction' : 'Add reaction'}
      >
        {existingEmoji ?? '+'}
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
