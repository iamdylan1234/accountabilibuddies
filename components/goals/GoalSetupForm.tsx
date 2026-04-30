'use client'

import { useState } from 'react'
import type { Goal, GoalType } from '@/types/database'

interface GoalDraft {
  id: string
  title: string
  type: GoalType
  target_count: string
}

const emptyGoal = (): GoalDraft => ({ id: crypto.randomUUID(), title: '', type: 'daily', target_count: '' })

interface Props {
  challengeId: string
  existingGoals: Goal[]
  onSubmit: (goals: GoalDraft[]) => Promise<void>
}

export default function GoalSetupForm({ challengeId, existingGoals, onSubmit }: Props) {
  const [goals, setGoals] = useState<GoalDraft[]>(
    existingGoals.length > 0
      ? existingGoals.map(g => ({
          id: g.id,
          title: g.title,
          type: g.type,
          target_count: g.target_count?.toString() ?? '',
        }))
      : [emptyGoal()]
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function updateGoal(i: number, field: keyof GoalDraft, value: string) {
    setGoals(prev => prev.map((g, idx) => idx === i ? { ...g, [field]: value } : g))
  }

  function addGoal() {
    if (goals.length >= 8) return
    setGoals(prev => [...prev, emptyGoal()])
  }

  function removeGoal(i: number) {
    if (goals.length <= 1) return
    setGoals(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const filled = goals.filter(g => g.title.trim())
    if (filled.length < 5) {
      setError('Add at least 5 goals.')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit(filled)
    } catch (err) {
      setError(String(err))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {goals.map((goal, i) => (
        <div key={goal.id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
            <input
              type="text"
              value={goal.title}
              onChange={e => updateGoal(i, 'title', e.target.value)}
              placeholder="Goal name (e.g. Run 5km)"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            {goals.length > 1 && (
              <button type="button" onClick={() => removeGoal(i)}
                className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
            )}
          </div>
          <div className="flex gap-2 ml-7">
            {(['daily', 'milestone', 'frequency'] as GoalType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => updateGoal(i, 'type', t)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  goal.type === t
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                style={goal.type === t ? { background: 'linear-gradient(135deg, #00C9A7, #0077B6)' } : {}}
              >
                {t}
              </button>
            ))}
            {goal.type === 'frequency' && (
              <input
                type="number"
                value={goal.target_count}
                onChange={e => updateGoal(i, 'target_count', e.target.value)}
                placeholder="× how many times?"
                min="1"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            )}
          </div>
        </div>
      ))}

      {goals.length < 8 && (
        <button type="button" onClick={addGoal}
          className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-teal-400 hover:text-teal-500 transition font-semibold">
          + Add goal ({goals.length}/8)
        </button>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-xl font-bold text-white text-sm"
        style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
      >
        {submitting ? 'Saving…' : 'Save goals & continue →'}
      </button>
    </form>
  )
}
