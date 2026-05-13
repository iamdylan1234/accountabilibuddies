import type { Goal } from '@/types/database'

interface Props {
  goal: Goal
  // Number of past scheduled days still outstanding (excludes today).
  missedDays: number
  isMyGoal: boolean
  onOpen: () => void
  // When today is also a scheduled day for this same frequency goal, the
  // catch-up tile becomes informational only — user should log today's tile
  // first. We render the same red shade but desaturated, and add a hint pill.
  isLocked?: boolean
  // Number of make-up check-ins logged today (today not being a scheduled day).
  // When > 0 the tile flips to amber to celebrate the catch-up — matches the
  // calendar's amber "Make-up" colour for visual consistency between Today
  // and Summary tabs.
  caughtUpToday?: number
}

const FULL_RED = 'linear-gradient(135deg, #fb7185, #f43f5e)'
// Same shade family, deeper + less saturated. Reads as "still important, but
// secondary to today" — clearly red, not greyed-out / disabled.
const LOCKED_RED = 'linear-gradient(135deg, #c95566, #b53344)'
// Matches the calendar sheet's makeup-day gradient so the two surfaces feel
// like one system.
const AMBER = 'linear-gradient(135deg, #fbbf24, #f59e0b)'

const PILL = 'text-[10px] font-black px-2 py-0.5 rounded-full bg-white/25 text-white whitespace-nowrap'

export default function MissedGoalCard({ goal, missedDays, isMyGoal, onOpen, isLocked, caughtUpToday = 0 }: Props) {
  // Three mutually exclusive primary states:
  //   - locked  : today is also a scheduled day for this goal (no make-up possible today)
  //   - amber   : at least one make-up was logged today (today is non-scheduled)
  //   - red     : pending misses, nothing caught up today yet
  // Locked & amber are mutually exclusive by construction (make-up only exists
  // on non-scheduled days; locked only fires when today IS scheduled).
  const isCaughtUp = !isLocked && caughtUpToday > 0

  // Pill labels
  const remainingLabel = missedDays === 1 ? '1 to catch up' : `${missedDays} to catch up`
  const stillToCatchUpLabel = missedDays === 1 ? '1 still to catch up' : `${missedDays} still to catch up`
  const caughtUpOnly = caughtUpToday === 1
    ? 'Caught up today'
    : `${caughtUpToday} caught up today`
  const caughtUpWithRemainder = caughtUpToday === 1
    ? '1 caught up today'
    : `${caughtUpToday} caught up today`

  const body = (
    <>
      {/* Title row grows so the pill row anchors to the bottom of the tile,
          aligning with the paired tile's pill row. */}
      <div className="flex-1 flex items-center gap-3 w-full">
        <span className="w-6 h-6 rounded-full border-2 border-white/60 flex-shrink-0" />
        <p className="text-sm font-bold leading-tight flex-1 min-w-0">{goal.title}</p>
      </div>
      {/* Single-row pill footer (no wrap). */}
      <div className="flex justify-end gap-1.5">
        {isCaughtUp ? (
          missedDays === 0 ? (
            <span className={PILL}>{caughtUpOnly}</span>
          ) : (
            <>
              <span className={PILL}>{caughtUpWithRemainder}</span>
              <span className={PILL}>{stillToCatchUpLabel}</span>
            </>
          )
        ) : (
          <>
            <span className={PILL}>{remainingLabel}</span>
            {isLocked && <span className={PILL}>log today first</span>}
          </>
        )}
      </div>
    </>
  )

  const background = isCaughtUp ? AMBER : isLocked ? LOCKED_RED : FULL_RED
  const style = { background }
  const layout = 'w-full h-full flex flex-col gap-2 rounded-xl px-4 py-3 text-white shadow-sm'

  // Buddy's catch-up tile — read-only view, render as div.
  if (!isMyGoal) {
    return <div className={layout} style={style}>{body}</div>
  }

  // Locked tile — non-interactive (today's also scheduled, can't make up
  // today). Button kept so user still gets tap-down feedback.
  if (isLocked) {
    return (
      <button type="button" onClick={() => {}}
        className={`${layout} text-left transition active:scale-95`}
        style={style}>
        {body}
      </button>
    )
  }

  // Amber (caught up today) — non-interactive. Today's make-up is already
  // logged; nothing more to do here. Matches the locked pattern.
  if (isCaughtUp) {
    return (
      <button type="button" onClick={() => {}}
        className={`${layout} text-left transition active:scale-95`}
        style={style}>
        {body}
      </button>
    )
  }

  // Red pending tile — ONE TAP logs today as a make-up. Parent wires onOpen
  // to handleToggle(goalId), so this triggers a single-action catch-up: no
  // calendar sheet, no date picker, the missed scheduled date stays missed.
  return (
    <button type="button" onClick={onOpen}
      className={`${layout} text-left transition active:scale-95 hover:opacity-90`}
      style={style}>
      {body}
    </button>
  )
}
