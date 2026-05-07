import type { Goal } from '@/types/database'

interface Props {
  goal: Goal
  missedDays: number
  isMyGoal: boolean
  onOpen: () => void
}

export default function MissedGoalCard({ goal, missedDays, isMyGoal, onOpen }: Props) {
  const label = missedDays === 1 ? '1 day late' : `${missedDays} days late`

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
