import type { Goal } from '@/types/database'

interface Props {
  goal: Goal
  missedDays: number
  isMyGoal: boolean
  onOpen: () => void
}

export default function MissedGoalCard({ goal, missedDays, isMyGoal, onOpen }: Props) {
  // For frequency goals (the only type that reaches this component today),
  // the missed count is "outstanding sessions to catch up" — not "days overdue".
  // Avoid the word "late" because users read it as "1 day ago" rather than "1 outstanding".
  const label = missedDays === 1 ? '1 to catch up' : `${missedDays} to catch up`

  if (isMyGoal) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="w-full flex items-start gap-3 rounded-xl px-4 py-3 text-left text-white transition active:scale-95 hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #fb7185, #f43f5e)' }}
      >
        <span className="w-5 h-5 rounded-full border-2 border-white/60 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">{goal.title}</p>
          <p className="text-xs font-black text-white/80 mt-1">{label}</p>
        </div>
      </button>
    )
  }

  return (
    <div
      className="w-full flex items-start gap-3 rounded-xl px-4 py-3 text-white"
      style={{ background: 'linear-gradient(135deg, #fb7185, #f43f5e)' }}
    >
      <span className="w-5 h-5 rounded-full border-2 border-white/60 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-tight">{goal.title}</p>
        <p className="text-xs font-black text-white/80 mt-1">{label}</p>
      </div>
    </div>
  )
}
