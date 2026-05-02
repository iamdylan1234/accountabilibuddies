'use client'

import { useState, useTransition } from 'react'
import { logValue } from '@/app/dashboard/checkin-actions'
import type { Goal, CheckIn } from '@/types/database'

interface Props {
  goal: Goal
  checkIns: CheckIn[]   // all check-ins for this goal across the challenge
  today: string
  isMyGoal: boolean
}

export default function CumulativeCard({ goal, checkIns, today, isMyGoal }: Props) {
  const [inputVal, setInputVal] = useState('')
  const [logging, setLogging] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [, startTransition] = useTransition()

  const totalLogged = checkIns
    .filter(c => c.goal_id === goal.id && c.value != null)
    .reduce((sum, c) => sum + (c.value ?? 0), 0)

  const target = goal.target_count ?? 0
  const pct = target > 0 ? Math.min(100, Math.round((totalLogged / target) * 100)) : 0
  const unit = goal.target_unit ?? ''

  const todayTotal = checkIns
    .filter(c => c.goal_id === goal.id && c.date === today && c.value != null)
    .reduce((sum, c) => sum + (c.value ?? 0), 0)

  function handleLog() {
    const v = parseFloat(inputVal)
    if (isNaN(v) || v <= 0) return
    setLogging(true)
    startTransition(async () => {
      await logValue(goal.id, today, v)
      setInputVal('')
      setShowInput(false)
      setLogging(false)
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <p className="flex-1 text-sm font-semibold text-gray-800">{goal.title}</p>
        <span className="text-xs font-black" style={{ color: '#0077B6' }}>{pct}%</span>
      </div>

      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #00C9A7, #0077B6)' }} />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {totalLogged}{unit ? ` ${unit}` : ''} / {target}{unit ? ` ${unit}` : ''}
          {todayTotal > 0 && <span className="text-teal-500 ml-2">(+{todayTotal} today)</span>}
        </span>
        {isMyGoal && (
          <button onClick={() => setShowInput(v => !v)}
            className="text-xs font-bold text-teal-600 hover:text-teal-700 transition">
            + Log
          </button>
        )}
      </div>

      {isMyGoal && showInput && (
        <div className="flex gap-2 mt-3">
          <input
            type="number"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder={unit ? `Enter ${unit}` : 'Enter amount'}
            min="0.01"
            step="any"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            onKeyDown={e => e.key === 'Enter' && handleLog()}
            autoFocus
          />
          <button onClick={handleLog} disabled={logging}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}>
            {logging ? '…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}
