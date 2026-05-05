import { Fragment } from 'react'
import type { ReactNode } from 'react'

function EmptyColumn() {
  return (
    <div className="flex items-center justify-center rounded-xl px-4 py-3 border border-dashed border-gray-200 min-h-[46px]">
      <span className="text-xs text-gray-300 font-semibold">No goals</span>
    </div>
  )
}

/**
 * Renders two ReactNode arrays as row-aligned pairs in a 2-column CSS grid
 * so cards at the same index always sit on the same horizontal row.
 *
 * If one column is empty a "No goals" placeholder is shown in its place.
 * Returns null when both columns are empty.
 */
export default function GoalPairGrid({
  myColumn,
  buddyColumn,
}: {
  myColumn: ReactNode[]
  buddyColumn: ReactNode[]
}) {
  const maxLen = Math.max(myColumn.length, buddyColumn.length)
  if (maxLen === 0) return null
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      {Array.from({ length: maxLen }, (_, i) => (
        <Fragment key={i}>
          {i === 0 && myColumn.length === 0 ? <EmptyColumn /> : (myColumn[i] ?? <div />)}
          {i === 0 && buddyColumn.length === 0 ? <EmptyColumn /> : (buddyColumn[i] ?? <div />)}
        </Fragment>
      ))}
    </div>
  )
}
