import ReactionPicker from './ReactionPicker'
import type { Goal, CheckIn, Reaction } from '@/types/database'

interface Props {
  goal: Goal
  checkIn: CheckIn | null
  reaction: Reaction | null
  isMyGoal: boolean
  today: string
  onToggle: (goalId: string) => void
  streak?: number
  isCatchUp?: boolean
}

export default function GoalCard({ goal, checkIn, reaction, isMyGoal, onToggle, streak, isCatchUp }: Props) {
  const done = !!checkIn

  const baseStyle = done
    ? { background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }
    : isCatchUp
    ? { background: '#fff1f2', border: '1.5px solid #fca5a5' }
    : {}

  const baseClass = done
    ? 'text-white'
    : isCatchUp
    ? 'text-red-600'
    : 'bg-gray-50 text-gray-700'

  if (isMyGoal) {
    return (
      <button type="button" onClick={() => onToggle(goal.id)}
        className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:opacity-90 ${baseClass}`}
        style={baseStyle}>
        <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
          done ? 'border-white bg-white/30' : isCatchUp ? 'border-red-300' : 'border-gray-300'
        }`}>
          {done && <span className="text-white text-xs font-bold">✓</span>}
        </span>
        <span className="text-sm font-semibold flex-1">{goal.title}</span>
        {isCatchUp && !done && <span className="text-xs font-bold text-red-400">LATE</span>}
        {streak !== undefined && streak >= 2 && (
          <span className={`text-xs font-bold ${done ? 'text-white/80' : 'text-orange-400'}`}>🔥{streak}</span>
        )}
        {goal.type === 'frequency' && (
          <span className={`text-xs font-bold ${done ? 'text-white/70' : 'text-gray-400'}`}>×{goal.target_count}</span>
        )}
      </button>
    )
  }

  return (
    <div className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 ${done ? 'text-white' : isCatchUp ? 'text-red-400' : 'bg-gray-50 text-gray-500'}`}
      style={done ? { background: 'linear-gradient(135deg, #00C9A7, #0077B6)' } : isCatchUp ? { background: '#fff1f2', border: '1.5px solid #fca5a5' } : {}}>
      <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
        done ? 'border-white bg-white/30' : isCatchUp ? 'border-red-300' : 'border-gray-300'
      }`}>
        {done && <span className="text-white text-xs font-bold">✓</span>}
      </span>
      <span className="text-sm font-semibold flex-1">{goal.title}</span>
      {isCatchUp && !done && <span className="text-xs font-bold text-red-400">LATE</span>}
      {streak !== undefined && streak >= 2 && (
        <span className={`text-xs font-bold ${done ? 'text-white/80' : 'text-orange-400'}`}>🔥{streak}</span>
      )}
      {done && checkIn && <ReactionPicker checkInId={checkIn.id} existingEmoji={reaction?.emoji} />}
    </div>
  )
}
