'use client'

import { useState, useTransition } from 'react'
import { updateName } from '@/app/settings/actions'

interface Props {
  currentName: string
  onClose: () => void
  onSaved: (newName: string) => void
}

export default function NameEditSheet({ currentName, onClose, onSaved }: Props) {
  const [name, setName] = useState(currentName)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateName(name)
      if (result?.error) {
        setError(result.error)
        return
      }
      onSaved(name.trim())
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-black text-gray-900 mb-1">Edit name</h2>
        <p className="text-sm text-gray-500 mb-4">This is the name your buddy sees.</p>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={50}
          autoFocus
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          placeholder="Your name"
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
            onClick={handleSave}
            disabled={pending || name.trim().length === 0 || name.trim() === currentName}
            className="flex-1 py-3 rounded-xl font-bold text-sm text-white bg-teal-500 disabled:opacity-50 active:scale-95 transition"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
