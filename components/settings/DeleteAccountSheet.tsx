'use client'

import { useState, useTransition } from 'react'
import { deleteAccount } from '@/app/settings/actions'

interface Props {
  onClose: () => void
}

export default function DeleteAccountSheet({ onClose }: Props) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const ready = text === 'DELETE'

  function handleDestroy() {
    setError(null)
    startTransition(async () => {
      const result = await deleteAccount(text)
      // deleteAccount redirects on success, so we only land here on error.
      if (result && 'error' in result) setError(result.error)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 pb-8" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-black text-red-500 mb-2">Delete account</h2>
        <p className="text-sm text-gray-700 mb-3">
          This permanently removes:
        </p>
        <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1 mb-4">
          <li>Your account and profile</li>
          <li>All your challenges (and your buddy&apos;s view of them)</li>
          <li>All your goals and check-ins</li>
          <li>Notification subscriptions</li>
        </ul>
        <p className="text-sm text-gray-700 mb-3">
          This cannot be undone. To confirm, type <span className="font-bold text-gray-900">DELETE</span> below:
        </p>
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          autoFocus
          autoComplete="off"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
          placeholder="Type DELETE"
        />
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="flex-1 py-3 rounded-xl font-bold text-sm text-gray-600 bg-gray-100 active:scale-95 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDestroy}
            disabled={!ready || pending}
            className="flex-1 py-3 rounded-xl font-bold text-sm text-white bg-red-500 disabled:opacity-50 active:scale-95 transition"
          >
            {pending ? 'Deleting…' : 'Delete forever'}
          </button>
        </div>
      </div>
    </div>
  )
}
