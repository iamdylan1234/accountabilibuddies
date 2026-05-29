'use client'

import { useActionState, useState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { createChallenge, type CreateChallengeState } from '@/app/dashboard/actions'
import Spinner from '@/components/shared/Spinner'
import { BRAND_GRADIENT } from '@/lib/brand'
import { daysBetween, formatDate } from '@/lib/dateUtils'

interface Props {
  defaultDate: string  // "YYYY-MM-DD" — suggested start (next Monday)
  minDate: string      // "YYYY-MM-DD" — earliest selectable (today)
}

/** Format YYYY-MM-DD as "May 17" — short, friendly, no year. */
function shortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return ''
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

/** Compute the end date 29 days after start (30-day inclusive window). */
function computeEndDate(startStr: string): string {
  const [y, m, d] = startStr.split('-').map(Number)
  if (!y || !m || !d) return ''
  const end = new Date(y, m - 1, d)
  end.setDate(end.getDate() + 29)
  const ey = end.getFullYear()
  const em = String(end.getMonth() + 1).padStart(2, '0')
  const ed = String(end.getDate()).padStart(2, '0')
  return `${ey}-${em}-${ed}`
}

/** "May Challenge" for a May start date. Tracks the START month. */
function suggestName(startStr: string): string {
  const [y, m, d] = startStr.split('-').map(Number)
  if (!y || !m || !d) return ''
  const monthName = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long' })
  return `${monthName} Challenge`
}

/** "Monday, June 1" — weekday + month + day, no year. */
function longDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return ''
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

/**
 * Client wrapper around the createChallenge server action. Provides:
 *   1. Live preview of the 30-day window (end date computed from start date).
 *   2. Dynamic default name that tracks the start date's month.
 *   3. Loading state via useFormStatus + inline errors via useActionState.
 */
export default function CreateChallengeForm({ defaultDate, minDate }: Props) {
  const [state, formAction] = useActionState<CreateChallengeState, FormData>(
    createChallenge,
    undefined,
  )
  const [startDate, setStartDate] = useState(defaultDate)
  const [name, setName] = useState(() => suggestName(defaultDate))
  // Track whether the user has manually edited the name. If yes, stop
  // auto-updating it as start date changes — respect their input.
  const [nameTouched, setNameTouched] = useState(false)

  // Resolve "today" after mount so the countdown uses the browser's local date
  // without an SSR/hydration mismatch (the server has no client clock). Until
  // mounted, the callout shows the start day without the "in N days" suffix.
  const [today, setToday] = useState<string | null>(null)
  useEffect(() => { setToday(formatDate(new Date())) }, [])

  const endDate = computeEndDate(startDate)
  const daysToStart = today ? daysBetween(today, startDate) : null
  const startsIn =
    daysToStart === null ? null
    : daysToStart <= 0 ? 'today'
    : daysToStart === 1 ? 'tomorrow'
    : `in ${daysToStart} days`

  function handleStartChange(newStart: string) {
    setStartDate(newStart)
    if (!nameTouched) setName(suggestName(newStart))
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Challenge name</label>
        <input
          name="month_name"
          type="text"
          required
          value={name}
          onChange={e => { setName(e.target.value); setNameTouched(true) }}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Start date</label>
        <input
          name="start_date"
          type="date"
          required
          min={minDate}
          value={startDate}
          onChange={e => handleStartChange(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        {/* Prominent start-date callout so it's unmistakable the challenge is
            scheduled for a future day (defaults to the next Monday), not "today".
            Updates live as the start date changes. */}
        {startDate && (
          <div className="mt-3 rounded-xl bg-teal-50 border border-teal-100 px-4 py-3">
            <p className="text-sm font-bold text-teal-800">
              🗓️ Starts {longDate(startDate)}{startsIn ? ` · ${startsIn}` : ''}
            </p>
            {daysToStart !== null && daysToStart > 0 && (
              <p className="text-xs text-teal-700/90 mt-1">
                Your challenge won&apos;t begin until then — pick an earlier date above to start sooner.
              </p>
            )}
            {daysToStart === 0 && (
              <p className="text-xs text-teal-700/90 mt-1">
                It begins as soon as your buddy joins and sets their goals.
              </p>
            )}
            {endDate && (
              <p className="text-xs text-gray-500 mt-1">30-day challenge · {shortDate(startDate)} → {shortDate(endDate)}</p>
            )}
          </div>
        )}
      </div>

      {state?.error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 rounded-xl font-bold text-white text-sm transition active:scale-95 disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2"
      style={{ background: BRAND_GRADIENT }}
    >
      {pending ? (
        <>
          <Spinner />
          <span>Creating…</span>
        </>
      ) : (
        <span>Create challenge →</span>
      )}
    </button>
  )
}
