'use client'

import type { Goal, CheckIn } from '@/types/database'
import { weeklyTrend } from '@/lib/heatmap'

interface Props {
  myName: string
  buddyName: string
  myGoals: Goal[]
  buddyGoals: Goal[]
  myCheckIns: CheckIn[]
  buddyCheckIns: CheckIn[]
  myScore: number       // 0..100
  buddyScore: number    // 0..100
  myDaysActive: number
  buddyDaysActive: number
  totalDays: number
  startDate: string
  today: string
}

function TrendChip({ delta }: { delta: number | null }) {
  if (delta === null) return null
  const isUp = delta > 0
  const isDown = delta < 0
  const flat = !isUp && !isDown
  const color = isUp ? 'text-teal-600 bg-teal-50' : isDown ? 'text-red-500 bg-red-50' : 'text-gray-400 bg-gray-100'
  const arrow = isUp ? '↑' : isDown ? '↓' : '→'
  const sign  = delta > 0 ? '+' : ''
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${color} mt-2`}>
      <span>{arrow}</span>
      <span>{sign}{delta}{flat ? '' : '%'} vs last week</span>
    </span>
  )
}

function HeroCard({
  name, score, daysActive, totalDays, trend, isLeading,
}: {
  name: string
  score: number
  daysActive: number
  totalDays: number
  trend: number | null
  isLeading: boolean
}) {
  return (
    <div
      className={`rounded-2xl px-5 py-4 bg-white border ${isLeading ? 'border-amber-300 shadow-sm' : 'border-gray-200'}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold text-gray-700">{name}{isLeading && <span aria-hidden="true" className="ml-1">👑</span>}</p>
        <p className="text-xs text-gray-400 font-semibold">{daysActive}/{totalDays} days active</p>
      </div>
      <p className="text-5xl font-black text-gray-900 leading-none mt-2">{score}<span className="text-3xl text-gray-400">%</span></p>
      <TrendChip delta={trend} />
    </div>
  )
}

/**
 * Hero score cards — replaces the small ScoreTileGrid on `/wrap-up`. Two
 * vertically-stacked cards, each with a big % number, the user's days-active,
 * an optional trend chip (last-7 vs prior-7 score delta), and a subtle gold
 * border on the leading card.
 */
export default function HeroScore({
  myName, buddyName,
  myGoals, buddyGoals, myCheckIns, buddyCheckIns,
  myScore, buddyScore,
  myDaysActive, buddyDaysActive, totalDays,
  startDate, today,
}: Props) {
  const myTrend    = weeklyTrend(myGoals,    myCheckIns,    startDate, today)
  const buddyTrend = weeklyTrend(buddyGoals, buddyCheckIns, startDate, today)
  const myLeading    = myScore > buddyScore
  const buddyLeading = buddyScore > myScore

  return (
    <div className="space-y-3 mb-6">
      <HeroCard name={myName}    score={myScore}    daysActive={myDaysActive}    totalDays={totalDays} trend={myTrend}    isLeading={myLeading} />
      <HeroCard name={buddyName} score={buddyScore} daysActive={buddyDaysActive} totalDays={totalDays} trend={buddyTrend} isLeading={buddyLeading} />
    </div>
  )
}
