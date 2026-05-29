'use client'

import { useState } from 'react'
import { proposeRematch } from '@/app/dashboard/rematch-actions'

export default function RematchButton({ finishedChallengeId, buddyName }: { finishedChallengeId: string; buddyName: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function go() {
    setBusy(true); setError(null)
    const res = await proposeRematch(finishedChallengeId)   // redirects to /setup on success
    if (res?.error) { setError(res.error); setBusy(false) }
  }
  return (
    <div className="mt-5">
      <button type="button" onClick={go} disabled={busy}
        className="w-full py-2.5 rounded-xl bg-white text-sm font-black text-teal-700 active:scale-95 transition disabled:opacity-60">
        {busy ? 'Sending…' : `🤜🤛 Run it back with ${buddyName}`}
      </button>
      {error && <p className="text-xs text-white/90 font-semibold mt-2">{error}</p>}
    </div>
  )
}
