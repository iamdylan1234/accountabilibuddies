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
        className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-white transition active:scale-95 hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #fb7185, #f43f5e)' }}
      >
        <span className="w-5 h-5 rounded-full border-2 border-white/60 flex-shrink-0" />
        <span className="text-sm font-bold flex-1 truncate">{goal.title}</span>
        <span className="text-xs font-black text-white/80 flex-shrink-0 ml-2">{label}</span>
      </button>
    )
  }

  return (
    <div
      className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-white"
      style={{ background: 'linear-gradient(135deg, #fda4af, #fb7185)' }}
    >
      <span className="w-5 h-5 rounded-full border-2 border-white/50 flex-shrink-0" />
      <span className="text-sm font-bold flex-1 truncate">{goal.title}</span>
      <span className="text-xs font-black text-white/70 flex-shrink-0 ml-2">{label}</span>
    </div>
  )
}
