'use client'

import { useState } from 'react'
import { scoreChallenge, getWeekStart } from '@/lib/scoring'
import { formatDate, addDays } from '@/lib/dateUtils'
import { useCheckInToggle } from '@/components/dashboard/useCheckInToggle'
import WeekHeader from './WeekHeader'
import WeekStrip from './WeekStrip'
import DayDetailSection from './DayDetailSection'
import ScoreTileGrid from '@/components/shared/ScoreTileGrid'
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
  myId: string
  // Below: kept for caller compatibility with `app/week/page.tsx`. Not used
  // internally by this component (the redesign moved the work elsewhere).
  challengeName: string
  totalDays: number
  challengeId: string
}

function clampToRange(date: string, start: string, end: string): string {
  if (date < start) return start
  if (date > end) return end
  return date
}

export default function WeekView({
  myGoals, buddyGoals, myCheckIns, buddyCheckIns,
  myProfile, buddyProfile, startDate, endDate, myId,
}: Props) {
  const now = new Date()
  const todayStr = formatDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  const currentWeekStartDate = getWeekStart(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  const currentWeekStart = formatDate(currentWeekStartDate)

  // Navigated week (defaults to current week)
  const [viewedWeekStart, setViewedWeekStart] = useState(currentWeekStart)
  const viewedWeekEnd = addDays(viewedWeekStart, 6)
  const isCurrentWeek = viewedWeekStart === currentWeekStart

  // Selected day within the viewed week
  const initialSelected = clampToRange(todayStr, viewedWeekStart, viewedWeekEnd)
  const [selectedDate, setSelectedDate] = useState(initialSelected)

  // Edit window: today or yesterday only (24h grace), and only in the current week.
  const yesterdayStr = addDays(todayStr, -1)
  const editable = isCurrentWeek && (selectedDate === todayStr || selectedDate === yesterdayStr)

  // Toggle handler — wired via useCheckInToggle so optimistic + persistence
  // logic stays consistent with the Today tab.
  const { optimisticCheckIns, handleToggle } = useCheckInToggle(myCheckIns, myId, todayStr)

  function handlePrevWeek() {
    const prev = addDays(viewedWeekStart, -7)
    setViewedWeekStart(prev)
    // After navigating to a past week, default the selected day to that
    // week's Sunday (clamped to challenge end).
    setSelectedDate(clampToRange(addDays(prev, 6), startDate, endDate))
  }

  function handleNextWeek() {
    const next = addDays(viewedWeekStart, 7)
    setViewedWeekStart(next)
    // When navigating forward toward current week, default selection to today
    // if the new week IS the current week, otherwise to that week's Sunday.
    if (next === currentWeekStart) {
      setSelectedDate(todayStr)
    } else {
      setSelectedDate(clampToRange(addDays(next, 6), startDate, endDate))
    }
  }

  // Score tiles — week-to-date totals for the VIEWED week.
  // Upper bound is min(viewedWeekEnd, today, challenge endDate).
  // Lower bound is max(viewedWeekStart, challenge startDate).
  const scoreUpper = clampToRange(viewedWeekEnd < todayStr ? viewedWeekEnd : todayStr, startDate, endDate)
  const scoreLower = viewedWeekStart < startDate ? startDate : viewedWeekStart

  const filterToWindow = (cs: CheckIn[]) =>
    cs.filter(c => c.date >= scoreLower && c.date <= scoreUpper)

  const myScore = scoreChallenge(myGoals, filterToWindow(optimisticCheckIns), 7, scoreLower, scoreUpper)
  const buddyScore = scoreChallenge(buddyGoals, filterToWindow(buddyCheckIns), 7, scoreLower, scoreUpper)
  const iWon = myScore > buddyScore
  const tied = myScore === buddyScore
  const bothPerfect = myScore === 100 && buddyScore === 100

  // Cannot navigate to future weeks beyond the current week.
  const canGoNext = !isCurrentWeek
  // Cannot navigate before the challenge's first week.
  const [csY, csM, csD] = startDate.split('-').map(Number)
  const challengeFirstWeek = formatDate(getWeekStart(new Date(csY, csM - 1, csD)))
  const canGoPrev = viewedWeekStart > challengeFirstWeek

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <WeekHeader
        weekStart={viewedWeekStart}
        weekEnd={viewedWeekEnd}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        onPrev={handlePrevWeek}
        onNext={handleNextWeek}
      />

      <WeekStrip
        weekStart={viewedWeekStart}
        today={todayStr}
        challengeStart={startDate}
        challengeEnd={endDate}
        myGoals={myGoals}
        buddyGoals={buddyGoals}
        myCheckIns={optimisticCheckIns}
        buddyCheckIns={buddyCheckIns}
        myName="You"
        buddyName={buddyProfile?.name ?? 'Buddy'}
        selectedDate={selectedDate}
        onSelectDay={setSelectedDate}
      />

      <ScoreTileGrid
        left={{
          name: myProfile?.name ?? 'Me',
          mainValue: `${myScore}%`,
          subLabel: 'week so far',
          isWinner: !tied && iWon,
        }}
        right={{
          name: buddyProfile?.name ?? 'Buddy',
          mainValue: `${buddyScore}%`,
          subLabel: 'week so far',
          isWinner: !tied && !iWon,
        }}
        tied={tied}
        bothPerfect={bothPerfect}
        selectNone
      />

      <div className="mt-4">
        <DayDetailSection
          selectedDate={selectedDate}
          weekStart={viewedWeekStart}
          weekEnd={viewedWeekEnd}
          today={todayStr}
          myGoals={myGoals}
          buddyGoals={buddyGoals}
          myCheckIns={optimisticCheckIns}
          buddyCheckIns={buddyCheckIns}
          editable={editable}
          onToggle={handleToggle}
        />
      </div>
    </div>
  )
}
