'use client'

import { useEffect, useState } from 'react'
import { BRAND_GRADIENT } from '@/lib/brand'

const SESSION_FLAG = 'accountabilibuddies-splash-shown'
const VISIBLE_MS = 1500
const FADE_MS = 500

export default function SplashOverlay() {
  // Render server-side hidden to avoid hydration mismatch. Decision is made in useEffect.
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Skip if already shown this session (e.g., user navigated away and back)
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(SESSION_FLAG)) {
      setMounted(false)
      return
    }
    sessionStorage.setItem(SESSION_FLAG, '1')
    setMounted(true)

    const fadeTimer = setTimeout(() => setVisible(false), VISIBLE_MS)
    const removeTimer = setTimeout(() => setMounted(false), VISIBLE_MS + FADE_MS)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [])

  if (!mounted) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center text-white px-6 overflow-hidden pointer-events-none"
      style={{
        background: BRAND_GRADIENT,
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease-out`,
      }}
    >
      {/* Yellow halo glow behind logo */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '32%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '420px',
          height: '420px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(249,248,113,0.30) 0%, rgba(249,248,113,0) 65%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center">
        <div className="w-36 h-36 rounded-3xl overflow-hidden bg-white shadow-xl mb-9 p-2.5">
          <img
            src="/icon.png"
            alt="Accountabilibuddies"
            className="w-full h-full object-contain"
          />
        </div>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none text-center mb-2">
          2 mates.
        </h1>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none text-center">
          No excuses.
        </h1>
      </div>

      <div
        className="absolute z-10 text-[10px] font-bold tracking-[2.5px] uppercase"
        style={{
          bottom: '36px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        accountabilibuddies
      </div>
    </div>
  )
}
