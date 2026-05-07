'use client'

import { useState, useTransition } from 'react'
import { approveChange, rejectChange } from '@/app/wrap-up/actions'
import type { Goal, GoalChangeRequest, Profile } from '@/types/database'
import { getAvatarUrl } from '@/lib/avatar'
import { BRAND_GRADIENT } from '@/lib/brand'

interface Props {
  requests: GoalChangeRequest[]
  goals: Goal[]
  myId: string
  myProfile: Profile
  buddyProfile: Profile | null
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const TYPE_LABEL: Record<string, string> = {
  daily: 'Daily',
  frequency: 'Frequency',
  cumulative: 'Cumulative',
  milestone: 'Milestone',
}

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

export default function PendingApprovalBanner({ requests, goals, myId, myProfile, buddyProfile }: Props) {
  const [, startTransition] = useTransition()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const toApprove = requests.filter(r => r.requester_id !== myId && r.status === 'pending')
  const myPending = requests.filter(r => r.requester_id === myId && r.status === 'pending')

  if (toApprove.length === 0 && myPending.length === 0) return null

  const buddyFirst = buddyProfile?.name?.split(' ')[0] ?? 'Buddy'

  return (
    <div className="space-y-3 mb-4">
      {/* Requests waiting for MY approval */}
      {toApprove.map(req => {
        const goal = goals.find(g => g.id === req.goal_id)
        const titleChanged = goal?.title !== req.proposed_title
        const typeChanged = req.proposed_type !== goal?.type
        const countChanged = req.proposed_target_count !== goal?.target_count
        const unitChanged = req.proposed_target_unit !== goal?.target_unit
        const datesChanged = !!req.proposed_schedule_dates
        const hasFieldDiff = typeChanged || countChanged || unitChanged || datesChanged

        return (
          <div
            key={req.id}
            className="bg-white rounded-xl shadow-sm p-4"
            style={{ borderLeft: '3px solid #fbbf24' }}
          >
            {/* Header: buddy avatar + label */}
            <div className="flex items-center gap-3 mb-3">
              {buddyProfile && (
                <img
                  src={getAvatarUrl(buddyProfile.id, buddyProfile.avatar_style)}
                  alt=""
                  className="w-10 h-10 rounded-full flex-shrink-0 bg-gray-100"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider leading-tight">
                  Approval needed
                </p>
                <p className="text-sm font-bold text-gray-900 leading-tight mt-0.5">
                  {buddyFirst} wants to change a goal
                </p>
              </div>
            </div>

            {/* Goal title — always shown, with rename diff inline */}
            <p className="text-sm font-semibold mb-2">
              {titleChanged ? (
                <>
                  <span className="text-gray-400 line-through">{goal?.title}</span>
                  <span className="mx-1.5 text-gray-400">→</span>
                  <span className="text-gray-900">{req.proposed_title}</span>
                </>
              ) : (
                <span className="text-gray-900">&quot;{goal?.title}&quot;</span>
              )}
            </p>

            {/* Field-level diff */}
            {hasFieldDiff && (
              <div className="text-xs space-y-1 mb-3 bg-gray-50 rounded-lg p-2.5">
                {typeChanged && (
                  <p className="text-gray-600">
                    Type:{' '}
                    <span className="text-gray-400 line-through">{TYPE_LABEL[goal?.type ?? 'daily']}</span>
                    {' → '}
                    <span className="text-teal-600 font-semibold">{TYPE_LABEL[req.proposed_type]}</span>
                  </p>
                )}
                {countChanged && (
                  <p className="text-gray-600">
                    Target:{' '}
                    <span className="text-gray-400 line-through">{goal?.target_count ?? '—'}</span>
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
                    <span className="text-gray-400 line-through">{goal?.target_unit ?? '—'}</span>
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

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => startTransition(() => approveChange(req.id))}
                className="flex-1 px-4 py-2 rounded-lg text-xs font-bold text-white transition active:scale-95"
                style={{ background: BRAND_GRADIENT }}
              >
                Approve
              </button>

              {confirmingId === req.id ? (
                <>
                  <button
                    onClick={() => {
                      setConfirmingId(null)
                      startTransition(() => rejectChange(req.id))
                    }}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-red-500 text-white hover:bg-red-600 transition"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmingId(null)}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmingId(req.id)}
                  className="px-4 py-2 rounded-lg text-xs font-bold border border-red-200 text-red-500 hover:bg-red-50 transition"
                >
                  Reject
                </button>
              )}
            </div>
          </div>
        )
      })}

      {/* MY pending requests — slim strip with my avatar */}
      {myPending.map(req => {
        const goal = goals.find(g => g.id === req.goal_id)
        return (
          <div
            key={req.id}
            className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3"
            style={{ borderLeft: '3px solid #cbd5e1' }}
          >
            <img
              src={getAvatarUrl(myProfile.id, myProfile.avatar_style)}
              alt=""
              className="w-8 h-8 rounded-full flex-shrink-0 bg-gray-100 opacity-70"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider leading-tight">
                Awaiting approval
              </p>
              <p className="text-sm text-gray-700 leading-tight mt-0.5 truncate">
                <span className="font-bold">{goal?.title}</span> — needs {buddyFirst}&apos;s OK
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
