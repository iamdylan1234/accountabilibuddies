import Link from 'next/link'
import type { CSSProperties } from 'react'
import { BRAND_GRADIENT } from '@/lib/brand'
import type { ChallengeStatus } from '@/types/database'

type ResultBadge = 'win' | 'loss' | 'tie' | 'in-progress'

interface Props {
  challengeId: string
  name: string
  dateRange: string       // "Jan 1 – Jan 30, 2025"
  buddyName: string
  myScore: number         // 0-100
  buddyScore: number      // 0-100
  result: ResultBadge
  status: ChallengeStatus
}

const BADGE: Record<ResultBadge, { label: string; className: string; style?: CSSProperties }> = {
  win:         { label: '✓ Win',       className: 'bg-teal-100 text-teal-700' },
  loss:        { label: '✗ Loss',      className: 'bg-red-100 text-red-500' },
  tie:         { label: '= Tie',       className: 'bg-gray-100 text-gray-500' },
  'in-progress': { label: 'In Progress', className: 'text-white', style: { background: BRAND_GRADIENT } },
}

export default function ChallengeHistoryCard({
  challengeId, name, dateRange, buddyName, myScore, buddyScore, result, status,
}: Props) {
  const badge = BADGE[result]

  return (
    <>
      <Link
        href={
          status === 'pending'
            ? `/setup?challenge=${challengeId}`
            : status === 'active'
            ? '/wrap-up'
            : `/wrap-up?challenge=${challengeId}`
        }
        className="block rounded-2xl bg-gray-50 px-4 py-3 mb-3 hover:bg-gray-100 transition active:scale-[0.99]"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-black text-gray-800 text-sm truncate">{name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{dateRange}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              vs {buddyName} · <span className="font-semibold text-gray-600">{myScore}%</span>
              {' '}vs <span className="font-semibold text-gray-500">{buddyScore}%</span>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={`text-xs font-black px-2 py-1 rounded-full ${badge.className}`}
              style={badge.style}
            >
              {badge.label}
            </span>
            <span className="text-gray-300 font-bold">›</span>
          </div>
        </div>
      </Link>
    </>
  )
}
