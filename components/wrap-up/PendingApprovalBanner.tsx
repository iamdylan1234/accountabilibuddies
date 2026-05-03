'use client'

import { useState, useTransition } from 'react'
import { approveChange, rejectChange } from '@/app/wrap-up/actions'
import type { Goal, GoalChangeRequest } from '@/types/database'

interface Props {
  requests: GoalChangeRequest[]
  goals: Goal[]
  myId: string
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatScheduleDates(dates: string[]): string {
  if (dates.length === 0) return 'none'
  if (dates.length <= 5) {
    return dates.map(d => {
      const [, m, day] = d.split('-').map(Number)
      return `${MONTHS[m - 1]} ${day}`
    }).join(', ')
  }
  return `${dates.length} dates`
}

export default function PendingApprovalBanner({ requests, goals, myId }: Props) {
  const [, startTransition] = useTransition()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const toApprove = requests.filter(r => r.requester_id !== myId && r.status === 'pending')
  const myPending = requests.filter(r => r.requester_id === myId && r.status === 'pending')

  if (toApprove.length === 0 && myPending.length === 0) return null

  return (
    <div className="space-y-3 mb-4">
      {toApprove.map(req => {
        const goal = goals.find(g => g.id === req.goal_id)
        const titleChanged = goal?.title !== req.proposed_title
        const typeChanged = req.proposed_type !== goal?.type
        const countChanged = req.proposed_target_count !== goal?.target_count
        const unitChanged = req.proposed_target_unit !== goal?.target_unit
        const datesChanged = !!req.proposed_schedule_dates

        return (
          <div key={req.id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-xs font-black text-yellow-700 uppercase tracking-wide mb-2">
              ⏳ Buddy wants to change a goal
            </p>

            {/* Title */}
            <p className="text-sm font-bold text-gray-800 mb-2">
              &quot;{goal?.title}&quot;
              {titleChanged && (
                <> → &quot;{req.proposed_title}&quot;</>
              )}
            </p>

            {/* Diff details */}
            {(typeChanged || countChanged || unitChanged || datesChanged) && (
              <div className="text-xs space-y-1 mb-3 bg-white/60 rounded-lg p-2 border border-yellow-100">
                {typeChanged && (
                  <p className="text-gray-600">
                    Type: <span className="text-red-400 line-through">{goal?.type}</span>
                    {' → '}
                    <span className="text-teal-600 font-semibold">{req.proposed_type}</span>
                  </p>
                )}
                {countChanged && (
                  <p className="text-gray-600">
                    Target:{' '}
                    <span className="text-red-400 line-through">{goal?.target_count ?? '—'}</span>
                    {' → '}
                    <span className="text-teal-600 font-semibold">{req.proposed_target_count ?? '—'}</span>
                    {(req.proposed_target_unit || goal?.target_unit) && (
                      <span className="text-gray-400"> {req.proposed_target_unit ?? goal?.target_unit}</span>
                    )}
                  </p>
                )}
                {unitChanged && !countChanged && (
                  <p className="text-gray-600">
                    Unit:{' '}
                    <span className="text-red-400 line-through">{goal?.target_unit ?? '—'}</span>
                    {' → '}
                    <span className="text-teal-600 font-semibold">{req.proposed_target_unit ?? '—'}</span>
                  </p>
                )}
                {datesChanged && (
                  <p className="text-gray-600">
                    Dates:{' '}
                    <span className="text-teal-600 font-semibold">
                      {formatScheduleDates(req.proposed_schedule_dates!)}
                    </span>
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => startTransition(() => approveChange(req.id))}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}>
                Approve
              </button>

              {confirmingId === req.id ? (
                <>
                  <span className="text-xs text-gray-500 font-semibold">Reject this change?</span>
                  <button
                    onClick={() => {
                      setConfirmingId(null)
                      startTransition(() => rejectChange(req.id))
                    }}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-red-500 text-white hover:bg-red-600 transition">
                    Yes, reject
                  </button>
                  <button
                    onClick={() => setConfirmingId(null)}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmingId(req.id)}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                  Reject
                </button>
              )}
            </div>
          </div>
        )
      })}

      {myPending.map(req => {
        const goal = goals.find(g => g.id === req.goal_id)
        return (
          <div key={req.id} className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs font-black text-blue-700 uppercase tracking-wide mb-1">
              ⏳ Pending buddy approval
            </p>
            <p className="text-sm text-gray-600">
              Change to <span className="font-bold">&quot;{goal?.title}&quot;</span> is awaiting your buddy&apos;s approval.
            </p>
          </div>
        )
      })}
    </div>
  )
}
