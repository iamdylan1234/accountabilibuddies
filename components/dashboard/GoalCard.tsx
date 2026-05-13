import ReactionPicker from './ReactionPicker'
import type { Goal, CheckIn, Reaction } from '@/types/database'
import { BRAND_GRADIENT } from '@/lib/brand'
import { FEATURES } from '@/lib/featureFlags'

interface Props {
  goal: Goal
  checkIn: CheckIn | null
  reaction: Reaction | null
  isMyGoal: boolean
  today: string
  onToggle: (goalId: string) => void
  streak?: number
  isCatchUp?: boolean
  remaining?: number
  hasFailed?: boolean
}

// Unified status-pill styling. All status indicators (Failed, LATE, streak, remaining)
// render as small pills in the bottom-right of a tile's footer row. Pill colour
// adapts to the tile's background state so contrast stays readable.
type PillVariant = 'fail' | 'late' | 'streak' | 'remaining'
type TileState = 'done' | 'catchUp' | 'default'

const PILL_BASE = 'text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap'

function pillClass(variant: PillVariant, state: TileState): string {
  // On the done (gradient) tile every pill is white-on-translucent-white for unity.
  if (state === 'done') return `${PILL_BASE} bg-white/25 text-white`
  if (variant === 'fail' || variant === 'late') return `${PILL_BASE} bg-red-100 text-red-700`
  if (variant === 'streak') return `${PILL_BASE} bg-orange-100 text-orange-700`
  // remaining
  return state === 'catchUp'
    ? `${PILL_BASE} bg-red-100 text-red-600`
    : `${PILL_BASE} bg-gray-200 text-gray-600`
}

export default function GoalCard({ goal, checkIn, reaction, isMyGoal, onToggle, streak, isCatchUp, remaining, hasFailed }: Props) {
  const done = !!checkIn
  const tileState: TileState = done ? 'done' : isCatchUp ? 'catchUp' : 'default'

  const baseStyle = done
    ? { background: BRAND_GRADIENT }
    : isCatchUp
    ? { background: '#fff1f2', border: '1.5px solid #fca5a5' }
    : {}

  // Default tile is white — it sits inside a gray-50 section card, so the
  // contrast comes from the section background, not the tile itself.
  const baseClass = done
    ? 'text-white'
    : isCatchUp
    ? 'text-red-600'
    : 'bg-white text-gray-700'

  // Decide which pills to show. `Failed` overrides `LATE` — you wouldn't say
  // both about the same tile, and Failed is the stronger signal.
  const showFailed = !!hasFailed
  const showLate = !showFailed && !!isCatchUp && !done
  const showStreak = streak !== undefined && streak >= 2
  const showRemaining = goal.type === 'frequency' && remaining !== undefined && remaining > 0

  // Cap visible pills at 2 in priority order Failed > LATE > Remaining > Streak.
  // The only realistic 3-pill case is {LATE, Remaining, Streak}, where the
  // streak pill is least meaningful — if you're behind, the streak is broken
  // anyway and bragging about it adds noise. Dropping it keeps the row narrow
  // enough to never wrap onto a second line on a tight mobile column.
  const visiblePills = [
    showFailed && <span key="fail" className={pillClass('fail', tileState)}>Failed</span>,
    showLate && <span key="late" className={pillClass('late', tileState)}>LATE</span>,
    showRemaining && <span key="remaining" className={pillClass('remaining', tileState)}>{remaining} left</span>,
    showStreak && <span key="streak" className={pillClass('streak', tileState)}>🔥{streak}</span>,
  ].filter(Boolean).slice(0, 2)
  const hasFooter = visiblePills.length > 0

  const footer = hasFooter && (
    <div className="flex justify-end gap-1.5">
      {visiblePills}
    </div>
  )

  // Title row uses `flex-1` to grow and fill the available vertical space —
  // its `items-center` then centers the checkbox+title vertically inside that
  // grown area. The footer pill row, having no flex-grow, sits at the
  // bottom of the tile. Result: title floats vertically centered in short
  // tiles, while pills always anchor to the bottom so they align horizontally
  // with the paired tile's pills regardless of title-length differences.
  const checkboxAndTitle = (
    <div className="flex-1 flex items-center gap-3 w-full">
      <span className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
        done ? 'border-white bg-white/30' : isCatchUp ? 'border-red-300' : 'border-gray-400'
      }`}>
        {done && <span className="text-white text-xs font-bold">✓</span>}
      </span>
      <span className="text-sm font-semibold flex-1">{goal.title}</span>
      {/* Buddy tile shows the reaction picker inline (it can't be tapped to toggle).
          Gated by FEATURES.reactions — feature is currently off; component and
          data flow preserved so flipping the flag is a one-line revert. */}
      {FEATURES.reactions && !isMyGoal && done && checkIn && <ReactionPicker checkInId={checkIn.id} existingEmoji={reaction?.emoji} />}
    </div>
  )

  // `h-full` makes the tile fill its grid cell so paired tiles share row
  // height. `shadow-sm` gives a subtle floating-card effect on the gray section.
  const layoutClass = `w-full h-full flex flex-col rounded-xl px-4 py-3 transition shadow-sm ${hasFooter ? 'gap-2' : ''} ${hasFailed ? 'ring-2 ring-red-400 ring-offset-1' : ''} ${baseClass}`

  if (isMyGoal) {
    return (
      <button type="button" onClick={() => onToggle(goal.id)}
        className={`${layoutClass} text-left active:scale-95 hover:opacity-90`}
        style={baseStyle}>
        {checkboxAndTitle}
        {footer}
      </button>
    )
  }

  return (
    <div className={layoutClass} style={baseStyle}>
      {checkboxAndTitle}
      {footer}
    </div>
  )
}
