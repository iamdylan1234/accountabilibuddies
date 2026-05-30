'use client'

import type { Goal, CheckIn } from '@/types/database'
import { weeklyResults, type WeekResult } from '@/lib/weekly'
import { BRAND_GRADIENT_H } from '@/lib/brand'

interface Props {
  myGoals: Goal[]
  buddyGoals: Goal[]
  myCheckIns: CheckIn[]
  buddyCheckIns: CheckIn[]
  myName: string
  buddyName: string
  startDate: string
  endDate: string
  today: string
}

function BarRow({ name, pct, isWinner }: { name: string; pct: number; isWinner: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold text-gray-700 flex-shrink-0 whitespace-nowrap">
        {name}{isWinner && <span aria-label="winner" className="ml-0.5">🏆</span>}
      </span>
      <div className="flex-1 bg-white rounded-full h-3 border border-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: BRAND_GRADIENT_H }}
        />
      </div>
      <span className="text-[10px] font-bold text-gray-700 w-9 text-right flex-shrink-0">{pct}%</span>
    </div>
  )
}

function WeekBlock({ result, myName, buddyName }: { result: WeekResult; myName: string; buddyName: string }) {
  const annotation =
    result.inProgress    ? <span className="text-[9px] text-gray-400 normal-case font-semibold">in progress</span> :
    result.winner === 'tie' ? <span aria-label="tied" title="Tied">🤝</span> :
    null

  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">
        <span>Week {result.weekNum} · {result.label}</span>
        <span>{annotation}</span>
      </div>
      <div className="space-y-1">
        <BarRow name={myName}    pct={result.myScore}    isWinner={result.winner === 'me'} />
        <BarRow name={buddyName} pct={result.buddyScore} isWinner={result.winner === 'buddy'} />
      </div>
    </div>
  )
}

/**
 * Per-week scorecard on `/wrap-up`. For each calendar week of the challenge,
 * shows both buddies' completion %, with a 🏆 next to the week's winner and
 * a 🤝 next to the week label for ties. The current week (today inside its
 * range) shows "in progress" instead of a trophy and scores partial
 * performance (no zero-filling of future days). Replaces the earlier
 * ChallengeHeatMap — same visual slot, different framing.
 */
export default function WeeklyScorecard({
  myGoals, buddyGoals, myCheckIns, buddyCheckIns,
  myName, buddyName, startDate, endDate, today,
}: Props) {
  const results = weeklyResults(myGoals, myCheckIns, buddyGoals, buddyCheckIns, startDate, endDate, today)

  return (
    <section className="mb-6">
      <h2 className="w-full text-center bg-stone-100 text-gray-600 text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-full mb-2 border border-gray-200">
        Week by week
      </h2>
      <div className="rounded-2xl bg-gray-100 p-3">
        {results.map(r => (
          <WeekBlock key={r.weekNum} result={r} myName={myName} buddyName={buddyName} />
        ))}
      </div>
    </section>
  )
}
