'use client'

import { useState, useEffect, useTransition } from 'react'
import { updateDailyMessage } from '@/app/dashboard/checkin-actions'

interface Props {
  currentMessage: string   // empty string if no message today
  onClose: () => void
}

export default function MessageEditSheet({ currentMessage, onClose }: Props) {
  const [text, setText] = useState(currentMessage)
  const [mounted, setMounted] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  function handleClose() {
    setMounted(false)
    setTimeout(onClose, 280)
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateDailyMessage(text)
      if (result?.error) {
        console.error('[MessageEditSheet] save error:', result.error)
      }
      handleClose()
    })
  }

  function handleClear() {
    startTransition(async () => {
      const result = await updateDailyMessage('')
      if (result?.error) {
        console.error('[MessageEditSheet] clear error:', result.error)
      }
      handleClose()
    })
  }

  const remaining = 150 - text.length

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${mounted ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="px-5 pt-3 pb-8">
          <p className="font-black text-gray-900 text-base mb-3">Today&apos;s message</p>

          <textarea
            value={text}
            onChange={e => setText(e.target.value.slice(0, 150))}
            placeholder="What's on your mind today?"
            maxLength={150}
            rows={3}
            disabled={isPending}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
            autoFocus
          />

          <p className={`text-xs mt-1 text-right ${remaining <= 20 ? 'text-red-400' : 'text-gray-400'}`}>
            {remaining} / 150
          </p>

          <div className="flex gap-3 mt-4">
            {text.trim().length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                disabled={isPending}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-red-500 border border-red-200 disabled:opacity-50"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(90deg,#0d9488,#3b82f6)' }}
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
