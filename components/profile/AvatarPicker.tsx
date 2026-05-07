'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { getAvatarUrl } from '@/lib/avatar'
import { updateAvatarStyle } from '@/app/profile/actions'

const STYLES = [
  'adventurer', 'adventurer-neutral', 'avataaars', 'avataaars-neutral',
  'big-ears', 'big-ears-neutral', 'big-smile', 'bottts', 'bottts-neutral',
  'croodles', 'croodles-neutral', 'dylan', 'fun-emoji', 'glass', 'icons',
  'identicon', 'initials', 'lorelei', 'lorelei-neutral', 'micah', 'miniavs',
  'notionists', 'notionists-neutral', 'open-peeps', 'personas', 'pixel-art',
  'pixel-art-neutral', 'rings', 'shapes', 'thumbs',
] as const

interface Props {
  userId: string
  currentStyle: string
  onStyleChange: (newStyle: string) => void
  onClose: () => void
}

export default function AvatarPicker({ userId, currentStyle, onStyleChange, onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const [, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  function handleClose() {
    setMounted(false)
    setTimeout(onClose, 280)
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    if (deltaY > 60 && (sheetRef.current?.scrollTop ?? 0) === 0) handleClose()
  }

  function handleSelect(style: string) {
    // Optimistic update: tell parent immediately
    onStyleChange(style)
    handleClose()

    startTransition(async () => {
      const result = await updateAvatarStyle(style)
      if (result.error) {
        // Roll back
        onStyleChange(currentStyle)
        setToast('Failed to save avatar. Please try again.')
        setTimeout(() => setToast(null), 3000)
      }
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto transition-transform duration-300 ease-out ${mounted ? 'translate-y-0' : 'translate-y-full'}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="font-black text-gray-800 text-base">Choose your avatar</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Grid: 5 columns × 6 rows = 30 styles */}
        <div className="grid grid-cols-5 gap-3 p-4">
          {STYLES.map(style => {
            const isActive = style === currentStyle
            return (
              <button
                key={style}
                type="button"
                onClick={() => handleSelect(style)}
                className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition active:scale-95 ${
                  isActive ? 'ring-2 ring-teal-500 bg-teal-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100">
                  <img
                    src={getAvatarUrl(userId, style)}
                    alt={style}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <span className="text-gray-400 leading-tight text-center"
                  style={{ fontSize: '9px' }}>
                  {style.replace(/-/g, ' ')}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] bg-red-500 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}
    </>
  )
}
