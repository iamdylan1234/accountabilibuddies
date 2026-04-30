'use client'

import { useState } from 'react'
import type { Goal, CheckIn } from '@/types/database'

interface Props {
  goal: Goal
  checkIns: CheckIn[]
  startDate: string
  endDate: string
  today: string
}

export default function GoalDrillDown({ goal, checkIns, startDate, endDate, today }: Props) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const days: string[] = []

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().split('T')[0])
  }

  function statusForDay(date: string) {
    if (date > today) return 'future'
    const hit = checkIns.some(c => c.goal_id === goal.id && c.date === date && c.completed)
    return hit ? 'done' : 'missed'
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
        Daily breakdown
      </p>
      <div className="grid grid-cols-7 gap-1">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="text-center text-xs font-bold text-gray-300">{d}</div>
        ))}
        {Array.from({ length: (new Date(startDate).getDay() + 6) % 7 }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {days.map(date => {
          const status = statusForDay(date)
          const isToday = date === today
          return (
            <div
              key={date}
              className="aspect-square rounded flex items-center justify-center text-xs font-bold"
              style={{
                background: isToday
                  ? '#F9F871'
                  : status === 'done'
                  ? '#00C9A7'
                  : status === 'missed'
                  ? '#f0f0f0'
                  : 'transparent',
                color: isToday ? '#0077B6' : status === 'done' ? 'white' : '#ccc',
              }}
            >
              {new Date(date).getDate()}
            </div>
          )
        })}
      </div>
    </div>
  )
}
