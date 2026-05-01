import ReactionPicker from './ReactionPicker'
import type { Goal, CheckIn, Reaction } from '@/types/database'

interface Props {
  goal: Goal
  checkIn: CheckIn | null
  reaction: Reaction | null
  isMyGoal: boolean
  today: string
  onToggle: (goalId: string) => void
}

export default function GoalCard({ goal, checkIn, reaction, isMyGoal, onToggle }: Props) {
  const done = !!checkIn

  if (isMyGoal) {
    return (
      <button
        type="button"
        onClick={() => onToggle(goal.id)}
        className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition ${
          done ? 'text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
        }`}
        style={done ? { background: 'linear-gradient(135deg, #00C9A7, #0077B6)' } : {}}
      >
        <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
          done ? 'border-white bg-white/30' : 'border-gray-300'
        }`}>
          {done && <span className="text-white text-xs font-bold">✓</span>}
        </span>
        <span className="text-sm font-semibold flex-1">{goal.title}</span>
        {goal.type === 'frequency' && (
          <span className={`text-xs font-bold ${done ? 'text-white/70' : 'text-gray-400'}`}>
            ×{goal.target_count}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 ${
      done ? 'text-white' : 'bg-gray-50 text-gray-500'
    }`}
      style={done ? { background: 'linear-gradient(135deg, #00C9A7, #0077B6)' } : {}}
    >
      <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
        done ? 'border-white bg-white/30' : 'border-gray-300'
      }`}>
        {done && <span className="text-white text-xs font-bold">✓</span>}
      </span>
      <span className="text-sm font-semibold flex-1">{goal.title}</span>
      {done && checkIn && (
        <ReactionPicker checkInId={checkIn.id} existingEmoji={reaction?.emoji} />
      )}
    </div>
  )
}
