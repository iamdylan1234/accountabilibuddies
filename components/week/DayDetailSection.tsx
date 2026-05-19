'use client'

import type { Goal, CheckIn } from '@/types/database'
import GoalCard from '@/components/dashboard/GoalCard'
import CumulativeCard from '@/components/dashboard/CumulativeCard'
import GoalPairGrid from '@/components/shared/GoalPairGrid'
import { getWeeklyStatChip } from '@/lib/scoring'

interface Props {
  selectedDate: string      // "YYYY-MM-DD"
  weekStart: string         // "YYYY-MM-DD" — used for the weekly-stat chip window
  weekEnd: string           // "YYYY-MM-DD"
  today: string
  myGoals: Goal[]
  buddyGoals: Goal[]
  myCheckIns: CheckIn[]     // ALL check-ins for the challenge (for weekly stat & cumulative totals)
  buddyCheckIns: CheckIn[]
  editable: boolean         // true only when selectedDate is today or yesterday (grace window)
  onToggle: (goalId: string, date: string) => void
}

const DAY_NAMES_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function dayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dayName = DAY_NAMES_LONG[dt.getDay()]
  const monthName = dt.toLocaleDateString('en-US', { month: 'long' })
  return `${dayName.toUpperCase()} · ${monthName.toUpperCase()} ${d}`
}

export default function DayDetailSection(props: Props) {
  const {
    selectedDate, weekStart, weekEnd, today,
    myGoals, buddyGoals, myCheckIns, buddyCheckIns,
    editable, onToggle,
  } = props

  // For frequency goals, "scheduled on the selected day" means
  // schedule_dates includes selectedDate.
  const isScheduledOn = (g: Goal, day: string) =>
    g.type === 'daily' ||
    (g.type === 'frequency' && (g.schedule_dates?.includes(day) ?? false))

  const dailySection = (gs: Goal[]) => gs.filter(g => isScheduledOn(g, selectedDate))
  // Ongoing section catches frequency goals with no schedule_dates (always-on
  // frequency targets) as well as frequency goals scheduled for OTHER days.
  // `?? false` ensures null/undefined schedule_dates fall through to here.
  const ongoingSection = (gs: Goal[]) => gs.filter(g =>
    g.type === 'cumulative' ||
    (g.type === 'frequency' && !(g.schedule_dates?.includes(selectedDate) ?? false))
  )
  const milestoneSection = (gs: Goal[]) => gs.filter(g => g.type === 'milestone')

  const myDaily = dailySection(myGoals)
  const buddyDaily = dailySection(buddyGoals)
  const myOngoing = ongoingSection(myGoals)
  const buddyOngoing = ongoingSection(buddyGoals)
  const myMilestone = milestoneSection(myGoals)
  const buddyMilestone = milestoneSection(buddyGoals)

  // Per-tile renderer. Wraps GoalCard with the weekly-stat chip and the
  // tap-to-toggle-direct behavior for editable cases (selectedDate is today
  // or yesterday). Read-only otherwise.
  function renderTile(goal: Goal, ownership: 'mine' | 'buddy') {
    const checkIns = ownership === 'mine' ? myCheckIns : buddyCheckIns

    if (goal.type === 'cumulative') {
      // Cumulative tiles are intentionally read-only on Week tab —
      // logging happens only from Today via CumulativeLogSheet, regardless
      // of whether the goal is mine or my buddy's.
      return (
        <CumulativeCard
          key={goal.id}
          goal={goal}
          checkIns={checkIns}
          today={today}
          isMyGoal={false}
        />
      )
    }

    const completedOnDay = checkIns.find(c => c.goal_id === goal.id && c.date === selectedDate && c.completed)
    const checkIn = completedOnDay ?? null
    const weeklyStat = getWeeklyStatChip(goal, weekStart, weekEnd, checkIns) ?? undefined
    const isMine = ownership === 'mine'
    const tappable = isMine && editable

    return (
      <GoalCard
        key={goal.id}
        goal={goal}
        checkIn={checkIn}
        reaction={null}
        isMyGoal={tappable}
        today={today}
        onToggle={tappable ? (id) => onToggle(id, selectedDate) : () => {}}
        weeklyStat={weeklyStat}
      />
    )
  }

  function renderSection(label: string, mine: Goal[], buddy: Goal[]) {
    if (mine.length === 0 && buddy.length === 0) return null
    return (
      <section className="mb-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{label}</h2>
        <div className="bg-gray-100 rounded-2xl p-3">
          <GoalPairGrid
            myColumn={mine.map(g => renderTile(g, 'mine'))}
            buddyColumn={buddy.map(g => renderTile(g, 'buddy'))}
          />
        </div>
      </section>
    )
  }

  const allEmpty =
    myDaily.length === 0 && buddyDaily.length === 0 &&
    myOngoing.length === 0 && buddyOngoing.length === 0 &&
    myMilestone.length === 0 && buddyMilestone.length === 0

  return (
    <div>
      <p className="text-xs font-bold text-gray-400 tracking-wider mb-3">
        {dayLabel(selectedDate)}
      </p>
      {allEmpty ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-2xl mb-1">😌</p>
          <p className="text-sm font-semibold">Rest day</p>
          <p className="text-xs mt-1">No goals scheduled.</p>
        </div>
      ) : (
        <>
          {renderSection('Daily Goals', myDaily, buddyDaily)}
          {renderSection('Ongoing', myOngoing, buddyOngoing)}
          {renderSection('Milestones', myMilestone, buddyMilestone)}
        </>
      )}
    </div>
  )
}
