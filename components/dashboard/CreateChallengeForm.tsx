'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { createChallenge, type CreateChallengeState } from '@/app/dashboard/actions'
import Spinner from '@/components/shared/Spinner'
import { BRAND_GRADIENT } from '@/lib/brand'

interface Props {
  defaultDate: string  // "YYYY-MM-DD"
}

/**
 * Client wrapper around the createChallenge server action. Two upgrades over
 * the previous bare `<form action={createChallenge}>`:
 *   1. useFormStatus drives a pending state on the submit button — user sees
 *      a spinner + "Creating…" label so the page doesn't feel frozen.
 *   2. useActionState reads errors returned from the server action and
 *      displays them inline instead of throwing silently. Was the missing
 *      half of Diego's bug — even after the FK fix, future errors would
 *      have been invisible to the user without this.
 */
export default function CreateChallengeForm({ defaultDate }: Props) {
  const [state, formAction] = useActionState<CreateChallengeState, FormData>(
    createChallenge,
    undefined,
  )

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Challenge name</label>
        <input
          name="month_name"
          type="text"
          required
          defaultValue="May Challenge"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Start date</label>
        <input
          name="start_date"
          type="date"
          required
          defaultValue={defaultDate}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
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
