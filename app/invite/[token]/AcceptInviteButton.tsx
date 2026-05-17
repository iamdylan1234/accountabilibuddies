'use client'

import { useFormStatus } from 'react-dom'
import Spinner from '@/components/shared/Spinner'

/**
 * Client wrapper for the accept-invite submit button so it can read
 * useFormStatus and show a spinner during the action. The form itself
 * stays in the server component (binds the token to the action).
 */
export default function AcceptInviteButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 rounded-xl font-bold text-sm transition active:scale-95 disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2"
      style={{ background: '#F9F871', color: '#0077B6' }}
    >
      {pending ? (
        <>
          <Spinner />
          <span>Joining…</span>
        </>
      ) : (
        <span>Accept invite & set my goals →</span>
      )}
    </button>
  )
}
