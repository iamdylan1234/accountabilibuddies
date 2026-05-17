import type { Goal, CheckIn } from '@/types/database'
import { computeWeeklyPlan, parseDate } from '@/lib/weekly-plan'
import { BRAND_GRADIENT } from '@/lib/brand'

interface Props {
  myGoals: Goal[]
  myCheckIns: CheckIn[]
  remainingWeeks: number
  sundayDate: string
  monthEndDate: string
}

const DAY_LABELS: Record<string, string> = {
  '0': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat',
}

export default function WeeklyPlan({
  myGoals, myCheckIns, remainingWeeks, sundayDate, monthEndDate,
}: Props) {
  const plans = myGoals.map(g =>
    computeWeeklyPlan(g, myCheckIns, remainingWeeks, sundayDate, monthEndDate)
  ).filter(p => p.neededThisWeek > 0)

  if (plans.length === 0) {
    return (
      <div className="mb-6 rounded-2xl p-5 text-white"
        style={{ background: BRAND_GRADIENT }}>
        <p className="font-black text-lg">You&apos;re on track! 🎉</p>
        <p className="text-white/70 text-sm mt-1">All goals are on pace for the 30 days.</p>
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-2xl border-2 overflow-hidden"
      style={{ borderColor: '#F9F871' }}>
      <div className="px-5 py-4"
        style={{ background: BRAND_GRADIENT }}>
        <p className="font-black text-white text-lg">This Week&apos;s Plan 📋</p>
        <p className="text-white/70 text-sm mt-0.5">
          Here&apos;s what you need to do this week to stay on track.
        </p>
      </div>
      <div className="bg-white divide-y divide-gray-50">
        {plans.map(({ goal, neededThisWeek, suggestedDays }) => (
          <div key={goal.id} className="px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-800">{goal.title}</span>
              <span className="text-xs font-black px-3 py-1 rounded-full text-white"
                style={{ background: BRAND_GRADIENT }}>
                {goal.type === 'milestone'
                  ? 'Do it this week!'
                  : `${neededThisWeek}× this week`}
              </span>
            </div>
            {suggestedDays.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {suggestedDays.map(date => (
                  <span key={date}
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: '#F9F871', color: '#0077B6' }}>
                    {DAY_LABELS[String(parseDate(date).getDay())]}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
