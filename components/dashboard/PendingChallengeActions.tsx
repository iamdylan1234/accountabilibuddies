'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { deleteChallenge } from '@/app/dashboard/actions'

interface Props {
  challengeId: string
}

export default function PendingChallengeActions({ challengeId }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleCancel() {
    startTransition(async () => {
      try {
        await deleteChallenge(challengeId)
      } catch (err) {
        console.error('[deleteChallenge] error:', err)
      }
    })
  }

  return (
    <div className="mt-8 space-y-3">
      <Link
        href={`/setup?challenge=${challengeId}`}
        className="block w-full text-center py-3 rounded-xl text-sm font-bold border-2 border-teal-500 text-teal-600 hover:bg-teal-50 transition"
      >
        Edit my goals
      </Link>

      {confirming ? (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-semibold text-gray-800 mb-3">Cancel this challenge?</p>
          <p className="text-xs text-gray-500 mb-4">
            This will delete the challenge and any goals you&apos;ve set. The invite link will stop working. This can&apos;t be undone.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="flex-1 py-2 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition"
            >
              {isPending ? 'Cancelling…' : 'Yes, cancel'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={isPending}
              className="flex-1 py-2 rounded-lg text-sm font-bold bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="block w-full text-center py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition"
        >
          Cancel this challenge
        </button>
      )}
    </div>
  )
}
