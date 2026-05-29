'use client'

import { useState } from 'react'
import { acceptRematch, declineRematch } from '@/app/dashboard/rematch-actions'
import { formatDate, addDays } from '@/lib/dateUtils'
import { BRAND_GRADIENT } from '@/lib/brand'

export default function RematchProposalCard({ challengeId, proposerName }: { challengeId: string; proposerName: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = formatDate(new Date())
  const start = addDays(today, 1)

  async function accept() {
    setBusy(true); setError(null)
    const res = await acceptRematch(challengeId, today)
    if (res?.error) { setError(res.error); setBusy(false) }
  }
  async function decline() {
    setBusy(true); setError(null)
    const res = await declineRematch(challengeId)
    if (res?.error) { setError(res.error); setBusy(false) }
  }

  return (
    <div className="rounded-2xl p-5 text-white" style={{ background: BRAND_GRADIENT }}>
      <p className="font-black text-base">🤜🤛 {proposerName} wants to run it back</p>
      <p className="text-white/80 text-xs mt-1">A new 30-day challenge starting tomorrow ({start}).</p>
      {error && <p className="text-xs text-white/90 font-semibold mt-2">{error}</p>}
      <div className="flex gap-2 mt-4">
        <button type="button" onClick={decline} disabled={busy}
          className="flex-1 py-2 rounded-xl text-sm font-bold bg-white/20 active:scale-95 transition disabled:opacity-60">
          Not now
        </button>
        <button type="button" onClick={accept} disabled={busy}
          className="flex-1 py-2 rounded-xl text-sm font-black bg-white text-teal-700 active:scale-95 transition disabled:opacity-60">
          {busy ? '…' : 'Accept'}
        </button>
      </div>
    </div>
  )
}
