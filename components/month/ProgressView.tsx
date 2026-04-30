'use client'

import { useState } from 'react'
import GoalDrillDown from './GoalDrillDown'
import { scoreChallenge, scoreGoal } from '@/lib/scoring'
import type { Goal, CheckIn, Profile } from '@/types/database'

interface Props {
  myGoals: Goal[]
  buddyGoals: Goal[]
  myCheckIns: CheckIn[]
  buddyCheckIns: CheckIn[]
  myProfile: Profile
  buddyProfile: Profile | null
  startDate: string
  endDate: string
  today: string
  totalDays: number
}

export default function ProgressView({
  myGoals, buddyGoals, myCheckIns, buddyCheckIns,
  myProfile, buddyProfile, startDate, endDate, today, totalDays,
}: Props) {
  const [activeTab, setActiveTab] = useState<'me' | 'buddy'>('me')
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null)

  const myScore = scoreChallenge(myGoals, myCheckIns, totalDays)
  const buddyScore = scoreChallenge(buddyGoals, buddyCheckIns, totalDays)

  const goals = activeTab === 'me' ? myGoals : buddyGoals
  const checkIns = activeTab === 'me' ? myCheckIns : buddyCheckIns

  const daysElapsed = Math.min(
    totalDays,
    Math.max(0, Math.floor((new Date(today).getTime() - new Date(startDate).getTime()) / 86400000) + 1)
  )

  function goalLabel(goal: Goal, checkIns: CheckIn[]) {
    const relevant = checkIns.filter(c => c.goal_id === goal.id && c.completed)
    if (goal.type === 'daily') return `${relevant.length}/${daysElapsed} days`
    if (goal.type === 'milestone') return relevant.length > 0 ? 'Done ✓' : 'Not yet'
    return `${relevant.length}/${goal.target_count} times`
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-black text-gray-900 mb-6">Monthly Progress</h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {[
          { profile: myProfile, score: myScore },
          { profile: buddyProfile, score: buddyScore },
        ].map(({ profile, score }) => (
          <div key={profile?.id ?? 'buddy'} className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-sm font-bold text-gray-500 mb-1">{profile?.name ?? 'Buddy'}</p>
            <p className="text-4xl font-black" style={{ color: '#0077B6' }}>{score}%</p>
            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${score}%`,
                  background: 'linear-gradient(90deg, #00C9A7, #0077B6)',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex border-b border-gray-200 mb-4">
        {(['me', 'buddy'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setExpandedGoal(null) }}
            className={`flex-1 py-2 text-sm font-bold transition ${
              activeTab === tab ? 'text-teal-600 border-b-2 border-teal-500' : 'text-gray-400'
            }`}
          >
            {tab === 'me' ? myProfile.name : (buddyProfile?.name ?? 'Buddy')}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {goals.map(goal => {
          const pct = Math.round(scoreGoal(goal, checkIns, totalDays) * 100)
          const isExpanded = expandedGoal === goal.id
          return (
            <div
              key={goal.id}
              className="bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:border-teal-200 transition"
              onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-800">{goal.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{goalLabel(goal, checkIns)}</p>
                </div>
                <span className="text-sm font-black" style={{ color: '#0077B6' }}>{pct}%</span>
                <span className="text-gray-300 text-xs">{isExpanded ? '▲' : '▼'}</span>
              </div>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #00C9A7, #0077B6)' }}
                />
              </div>
              {isExpanded && (
                <GoalDrillDown
                  goal={goal}
                  checkIns={checkIns}
                  startDate={startDate}
                  endDate={endDate}
                  today={today}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
