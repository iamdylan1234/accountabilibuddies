import type { Goal } from '@/types/database'

interface Props {
  goal: Goal
  missedDays: number
  isMyGoal: boolean
  onOpen: () => void
  // When today is also a scheduled day for this same frequency goal, the
  // catch-up tile becomes informational only — user should log today's tile
  // first. We render the same red shade but desaturated, and add a hint pill.
  isLocked?: boolean
}

const FULL_RED = 'linear-gradient(135deg, #fb7185, #f43f5e)'
// Same shade family, deeper + less saturated. Reads as "still important, but
// secondary to today" — clearly red, not greyed-out / disabled.
const LOCKED_RED = 'linear-gradient(135deg, #c95566, #b53344)'

const PILL = 'text-[10px] font-black px-2 py-0.5 rounded-full bg-white/25 text-white whitespace-nowrap'

export default function MissedGoalCard({ goal, missedDays, isMyGoal, onOpen, isLocked }: Props) {
  // For frequency goals (the only type that reaches this component today),
  // the missed count is "outstanding sessions to catch up" — not "days overdue".
  // Avoid the word "late" because users read it as "1 day ago" rather than "1 outstanding".
  const countLabel = missedDays === 1 ? '1 to catch up' : `${missedDays} to catch up`

  const body = (
    <>
      <div className="flex items-center gap-3 w-full">
        <span className="w-5 h-5 rounded-full border-2 border-white/60 flex-shrink-0" />
        <p className="text-sm font-bold leading-tight flex-1 min-w-0">{goal.title}</p>
      </div>
      {/* Single-row pill footer (no wrap) — at most 2 short pills. */}
      <div className="flex justify-end gap-1.5">
        <span className={PILL}>{countLabel}</span>
        {isLocked && <span className={PILL}>log today first</span>}
      </div>
    </>
  )

  const style = { background: isLocked ? LOCKED_RED : FULL_RED }
  // `justify-center` vertically centers the title+footer block in the tile,
  // matching GoalCard's behavior in paired rows.
  const layout = 'w-full h-full flex flex-col justify-center gap-2 rounded-xl px-4 py-3 text-white'

  // Buddy's catch-up tile — read-only view, render as div.
  if (!isMyGoal) {
    return <div className={layout} style={style}>{body}</div>
  }

  // Locked tile — still a button so the user gets tap-down feedback (the app
  // saw their tap), but the click handler is a no-op. The visible "log today
  // first" pill in the body communicates the actual instruction. No hover
  // because hover-suggesting interactivity would be misleading.
  if (isLocked) {
    return (
      <button type="button" onClick={() => {}}
        className={`${layout} text-left transition active:scale-95`}
        style={style}>
        {body}
      </button>
    )
  }

  return (
    <button type="button" onClick={onOpen}
      className={`${layout} text-left transition active:scale-95 hover:opacity-90`}
      style={style}>
      {body}
    </button>
  )
}
