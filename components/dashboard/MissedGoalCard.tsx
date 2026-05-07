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
        className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left bg-white shadow-sm transition active:scale-95 hover:opacity-90"
        style={{ borderLeft: '3px solid #f87171' }}
      >
        <span className="w-5 h-5 rounded-full border-2 border-red-300 flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-900 flex-1 truncate">{goal.title}</span>
        <span className="text-xs font-black text-red-400 flex-shrink-0 ml-2">{label}</span>
      </button>
    )
  }

  return (
    <div
      className="w-full flex items-center gap-3 rounded-xl px-4 py-3 bg-white shadow-sm"
      style={{ borderLeft: '3px solid #fca5a5' }}
    >
      <span className="w-5 h-5 rounded-full border-2 border-red-200 flex-shrink-0" />
      <span className="text-sm font-semibold text-gray-700 flex-1 truncate">{goal.title}</span>
      <span className="text-xs font-black text-red-300 flex-shrink-0 ml-2">{label}</span>
    </div>
  )
}
