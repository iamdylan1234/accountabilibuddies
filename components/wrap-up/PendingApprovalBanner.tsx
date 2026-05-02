'use client'

import { useTransition } from 'react'
import { approveChange, rejectChange } from '@/app/wrap-up/actions'
import type { Goal, GoalChangeRequest } from '@/types/database'

interface Props {
  requests: GoalChangeRequest[]
  goals: Goal[]
  myId: string
}

export default function PendingApprovalBanner({ requests, goals, myId }: Props) {
  const [, startTransition] = useTransition()

  const toApprove = requests.filter(r => r.requester_id !== myId && r.status === 'pending')
  const myPending = requests.filter(r => r.requester_id === myId && r.status === 'pending')

  if (toApprove.length === 0 && myPending.length === 0) return null

  return (
    <div className="space-y-3 mb-4">
      {toApprove.map(req => {
        const goal = goals.find(g => g.id === req.goal_id)
        return (
          <div key={req.id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-xs font-black text-yellow-700 uppercase tracking-wide mb-2">
              ⏳ Buddy wants to change a goal
            </p>
            <p className="text-sm text-gray-700 mb-1">
              <span className="font-bold">&quot;{goal?.title}&quot;</span>
              {goal?.title !== req.proposed_title && (
                <> → <span className="font-bold">&quot;{req.proposed_title}&quot;</span></>
              )}
            </p>
            {req.proposed_type !== goal?.type && (
              <p className="text-xs text-gray-500 mb-1">{goal?.type} → {req.proposed_type}</p>
            )}
            {req.proposed_schedule_dates && (
              <p className="text-xs text-gray-500 mb-1">
                {req.proposed_schedule_dates.length} scheduled dates
              </p>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => startTransition(() => approveChange(req.id))}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}>
                Approve
              </button>
              <button
                onClick={() => startTransition(() => rejectChange(req.id))}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200">
                Reject
              </button>
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
