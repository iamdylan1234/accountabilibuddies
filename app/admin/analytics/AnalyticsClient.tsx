'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell,
} from 'recharts'
import { BRAND_GRADIENT } from '@/lib/brand'
import type {
  HeroKpis, TrajectoryPoint, PairHealth, GoalMixRow, FunnelStage, UserRow,
} from '@/lib/analytics-queries'

interface Props {
  hero: HeroKpis
  trajectory: TrajectoryPoint[]
  pairs: PairHealth[]
  goalMix: GoalMixRow[]
  funnel: FunnelStage[]
  users: UserRow[]
  generatedAt: string
}

const TYPE_COLOURS: Record<string, string> = {
  daily: '#00C9A7',
  frequency: '#0077B6',
  cumulative: '#f59e0b',
  milestone: '#8b5cf6',
}

// ── Health computation ──────────────────────────────────────────────────────
type WidgetStatus = 'healthy' | 'watch' | 'action'
interface Health { status: WidgetStatus; advice?: string }

function heroHealth(hero: HeroKpis, pairCount: number): Health {
  const activatedPct = hero.totalUsers > 0 ? hero.activatedUsers / hero.totalUsers : 0
  const dauRatio = hero.totalUsers > 0 ? hero.dau / hero.totalUsers : 0
  if (activatedPct < 0.4) return {
    status: 'action',
    advice: `Only ${Math.round(activatedPct * 100)}% of signups have ever checked in. The onboarding flow is leaking. Highest-leverage fixes: goal templates, a "play solo for 7 days" mode, or a welcome push that guides them to first check-in.`,
  }
  if (pairCount === 0 && hero.totalUsers > 2) return {
    status: 'watch',
    advice: 'Users are signing up but no buddy pairs are active. The invite flow may be failing — check that share links work and people understand the "wait for buddy" step.',
  }
  if (dauRatio < 0.2 && hero.totalUsers > 5) return {
    status: 'watch',
    advice: `DAU is ${hero.dau}/${hero.totalUsers} (${Math.round(dauRatio * 100)}%). For a daily-habit app, under 25% means users aren't returning each day. Push notifications are the highest-ROI fix.`,
  }
  return { status: 'healthy' }
}

function trajectoryHealth(trajectory: TrajectoryPoint[]): Health {
  if (trajectory.length < 14) return { status: 'healthy' }
  const last7 = trajectory.slice(-7).reduce((s, p) => s + p.checkins, 0)
  const prev7 = trajectory.slice(-14, -7).reduce((s, p) => s + p.checkins, 0)
  if (prev7 === 0) return { status: 'healthy' }
  const ratio = last7 / prev7
  if (ratio < 0.7) return {
    status: 'action',
    advice: `Check-ins dropped ${Math.round((1 - ratio) * 100)}% week-over-week (${prev7} → ${last7}). Investigate: a recent change you shipped? A power user gone quiet? A holiday? If the trend holds another 7 days, it's a churn signal.`,
  }
  if (ratio < 1.0) return {
    status: 'watch',
    advice: `Slight week-over-week decline (${prev7} → ${last7}). Watch for another week before acting — but check whether one specific user dropped off.`,
  }
  return { status: 'healthy' }
}

function funnelHealth(funnel: FunnelStage[]): Health {
  let worst = { from: '', to: '', dropPct: 0 }
  for (let i = 1; i < funnel.length; i++) {
    const prev = funnel[i - 1].count
    if (prev === 0) continue
    const dropPct = (prev - funnel[i].count) / prev
    if (dropPct > worst.dropPct) {
      worst = { from: funnel[i - 1].label, to: funnel[i].label, dropPct }
    }
  }
  const stageAdvice: Record<string, string> = {
    'In a challenge': 'Users sign up but never create or join a challenge. Either onboarding doesn\'t explain what to do next, or the create-challenge form is intimidating.',
    'Set goals': 'Users join challenges but never pick goals. Add goal templates or starter packs ("popular goals" suggestions).',
    'First check-in': 'Users set goals then never check in once. Either they forgot, or they can\'t figure out where to tap. Send a Day 1 nudge.',
    'Active (3d)': 'Users check in once then disappear. The classic retention gap — push notifications fix most of this.',
  }
  if (worst.dropPct > 0.5) return {
    status: 'action',
    advice: `Biggest leak: ${Math.round(worst.dropPct * 100)}% drop at "${worst.from} → ${worst.to}". ${stageAdvice[worst.to] ?? 'Investigate what\'s blocking users at this step.'}`,
  }
  if (worst.dropPct > 0.3) return {
    status: 'watch',
    advice: `Notable drop (${Math.round(worst.dropPct * 100)}%) at "${worst.from} → ${worst.to}". ${stageAdvice[worst.to] ?? 'Worth watching.'}`,
  }
  return { status: 'healthy' }
}

function goalMixHealth(goalMix: GoalMixRow[]): Health {
  if (goalMix.length === 0) return { status: 'watch', advice: 'No goals exist yet.' }
  const avgCompletion = goalMix.reduce((s, g) => s + g.avgCompletion, 0) / goalMix.length
  const missingTypes = (['daily', 'frequency', 'cumulative', 'milestone'] as const).filter(t => !goalMix.some(g => g.type === t))
  if (avgCompletion < 20) return {
    status: 'action',
    advice: `Average completion is only ${Math.round(avgCompletion)}%. Users are setting goals they can't keep. Consider nudging "most successful users set 3-5 goals, not 8" in the setup form, or surface a "scale back" option for goals stuck at 0%.`,
  }
  if (missingTypes.length > 0) return {
    status: 'watch',
    advice: `Goal types not in use: ${missingTypes.join(', ')}. ${missingTypes.includes('cumulative') ? 'Cumulative was bug-blocked until recently — watch if it picks up. ' : ''}Otherwise, the type picker may need clearer descriptions or examples.`,
  }
  if (avgCompletion < 35) return {
    status: 'watch',
    advice: `Completion averaging ${Math.round(avgCompletion)}%. OK but soft. Successful habit apps typically run 40-60%.`,
  }
  return { status: 'healthy' }
}

function pairsHealth(pairs: PairHealth[]): Health {
  if (pairs.length === 0) return { status: 'watch', advice: 'No active pairs yet. Without functioning buddy relationships, the app loses its main differentiator.' }
  const ghost = pairs.filter(p => (p.creatorDays === 0) !== (p.buddyDays === 0))
  const lopsided = pairs.filter(p => {
    if (p.creatorDays === 0 || p.buddyDays === 0) return false
    const ratio = Math.max(p.creatorDays, p.buddyDays) / Math.min(p.creatorDays, p.buddyDays)
    return ratio >= 2
  })
  if (ghost.length > 0) return {
    status: 'action',
    advice: `${ghost.length} ghost pair${ghost.length > 1 ? 's' : ''}: one buddy fully active, the other never checked in. The engaged partner will likely quit. Consider a re-engagement nudge to the silent partner — or surface the imbalance in the active partner's UI so they can prompt their buddy.`,
  }
  if (lopsided.length > 0) return {
    status: 'watch',
    advice: `${lopsided.length} lopsided pair${lopsided.length > 1 ? 's' : ''}: one buddy is 2×+ more active than the other. Risk of frustration for the active side. Worth a passive "your buddy seems quiet" nudge.`,
  }
  return { status: 'healthy' }
}

function usersHealth(users: UserRow[]): Health {
  if (users.length === 0) return { status: 'healthy' }
  const never = users.filter(u => u.status === 'never_activated').length
  const pct = never / users.length
  if (pct > 0.5) return {
    status: 'action',
    advice: `${never} of ${users.length} users (${Math.round(pct * 100)}%) never checked in. Onboarding leak is the single highest-impact fix right now. See the Funnel widget for the exact step they're dying at.`,
  }
  if (pct > 0.3) return {
    status: 'watch',
    advice: `${Math.round(pct * 100)}% of users never activated. Onboarding has high leverage.`,
  }
  return { status: 'healthy' }
}

const STATUS_BADGES: Record<WidgetStatus, { label: string; className: string }> = {
  healthy: { label: '🟢 Healthy',  className: 'bg-teal-100 text-teal-700' },
  watch:   { label: '🟡 Watch',    className: 'bg-amber-100 text-amber-700' },
  action:  { label: '🔴 Action',   className: 'bg-red-100 text-red-700' },
}

export default function AnalyticsClient(props: Props) {
  const router = useRouter()
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date(props.generatedAt))

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => {
      router.refresh()
      setLastRefresh(new Date())
    }, 30000)
    return () => clearInterval(id)
  }, [autoRefresh, router])

  const secondsAgo = Math.floor((Date.now() - lastRefresh.getTime()) / 1000)

  const engagedPairCount = props.pairs.filter(p => p.creatorDays > 0 && p.buddyDays > 0).length
  const heroH = heroHealth(props.hero, engagedPairCount)
  const trajH = trajectoryHealth(props.trajectory)
  const funnelH = funnelHealth(props.funnel)
  const goalMixH = goalMixHealth(props.goalMix)
  const pairsH = pairsHealth(props.pairs)
  const usersH = usersHealth(props.users)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="rounded-2xl px-5 py-4 text-white flex items-center justify-between" style={{ background: BRAND_GRADIENT }}>
        <div>
          <p className="text-xs font-bold opacity-80 uppercase tracking-wide">Admin · anonymised</p>
          <h1 className="font-black text-xl">Analytics</h1>
        </div>
        <div className="text-right">
          <button
            type="button"
            onClick={() => setAutoRefresh(v => !v)}
            className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30"
          >
            {autoRefresh ? '⏸ Pause auto-refresh' : '▶ Resume auto-refresh'}
          </button>
          <p className="text-[10px] opacity-70 mt-1">Refreshed {secondsAgo}s ago</p>
        </div>
      </div>

      {/* Hero KPIs intro */}
      <Card
        title="At-a-glance health"
        description="Snapshot of the product's pulse. Activated % under 50 hints at an onboarding leak. DAU / Total ratio above 30% is sticky (healthy for a daily-habit app). Engaged pairs is the truest signal — buddy relationships that are actually functioning."
        health={heroH}
      />

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total users" value={props.hero.totalUsers} />
        <Kpi label="Activated" value={`${props.hero.activatedUsers} (${pct(props.hero.activatedUsers, props.hero.totalUsers)})`} />
        <Kpi label="DAU (24h)" value={props.hero.dau} />
        <Kpi label="WAU (7d)" value={props.hero.wau} />
        <Kpi label="MAU (30d)" value={props.hero.mau} />
        <Kpi label="Check-ins 24h" value={props.hero.checkinsLast24h} />
        <Kpi label="Check-ins 7d" value={props.hero.checkinsLast7d} />
        <Kpi label="Engaged pairs" value={props.pairs.filter(p => p.creatorDays > 0 && p.buddyDays > 0).length} />
      </div>

      {/* Trajectory */}
      <Card
        title="Engagement — last 30 days"
        description="Daily check-in volume (blue) and unique users (teal). Climbing lines = real growth. Flat = plateau. Diverging — check-ins up but users flat — means your core users are intensifying. Sustained downward trend usually means notifications are missing."
        health={trajH}
      >
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={props.trajectory}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line type="monotone" dataKey="checkins" stroke="#0077B6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="users" stroke="#00C9A7" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-400 mt-2">
          <span className="inline-block w-3 h-0.5 bg-[#0077B6] align-middle mr-1" /> check-ins
          <span className="inline-block w-3 h-0.5 bg-[#00C9A7] align-middle ml-3 mr-1" /> unique users
        </p>
      </Card>

      {/* Funnel */}
      <Card
        title="Funnel — drop-off by stage"
        description="Where users die between signup and active use. The biggest red number is your biggest leak. 'In challenge → Set goals' drop = users don't know what goals to set (templates would help). 'First check-in → Active 3d' drop = retention problem (push notifications fix most of these)."
        health={funnelH}
      >
        <div className="space-y-2">
          {props.funnel.map((stage, i) => {
            const prev = i === 0 ? null : props.funnel[i - 1].count
            const dropPct = prev && prev > 0 ? Math.round(((prev - stage.count) / prev) * 100) : 0
            const widthPct = props.funnel[0].count > 0 ? Math.round((stage.count / props.funnel[0].count) * 100) : 0
            return (
              <div key={stage.label} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-600 w-32 flex-shrink-0">{stage.label}</span>
                <div className="flex-1 bg-gray-100 rounded-lg h-7 relative overflow-hidden">
                  <div className="h-full rounded-lg flex items-center px-2 text-white text-xs font-bold" style={{ width: `${widthPct}%`, background: BRAND_GRADIENT }}>
                    {stage.count}
                  </div>
                </div>
                {i > 0 && dropPct > 0 && (
                  <span className="text-xs text-red-500 font-semibold w-16 text-right">−{dropPct}%</span>
                )}
                {i === 0 && <span className="w-16" />}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Goal mix */}
      <Card
        title="Goal mix + completion rate"
        description="What people choose and how well they stick to it. Low count on a type = not discoverable enough. Low completion (<30%) on a type = users set them too ambitiously OR the UX makes checking in painful. Compare across types to spot which goal types your users actually finish."
        health={goalMixH}
      >
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={props.goalMix}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="type" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="count">
              {props.goalMix.map(g => (
                <Cell key={g.type} fill={TYPE_COLOURS[g.type] ?? '#94a3b8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-4 gap-2 mt-3 text-center">
          {props.goalMix.map(g => (
            <div key={g.type} className="text-xs">
              <p className="font-bold text-gray-700">{g.type}</p>
              <p className="text-gray-400">{g.avgCompletion}% avg done</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Pair health */}
      <Card
        title="Pair health (anonymised)"
        description="How balanced each buddy pair is. Both columns roughly equal = healthy. One side at zero = ghost pair (the engaged person will eventually quit because their buddy isn't showing up). Big gap = lopsided — the active partner may feel they're carrying the relationship."
        health={pairsH}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase tracking-wide text-[10px]">
                <th className="text-left py-2 px-2">Pair</th>
                <th className="text-right py-2 px-2">Goals</th>
                <th className="text-right py-2 px-2">Days in</th>
                <th className="text-right py-2 px-2">Creator active</th>
                <th className="text-right py-2 px-2">Buddy active</th>
              </tr>
            </thead>
            <tbody>
              {props.pairs.map((p, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="py-2 px-2 font-mono text-gray-700">{p.anonCreator} ↔ {p.anonBuddy}</td>
                  <td className="py-2 px-2 text-right text-gray-600">{p.goalCount}</td>
                  <td className="py-2 px-2 text-right text-gray-600">{p.daysSinceStart}</td>
                  <td className="py-2 px-2 text-right font-bold text-teal-600">{p.creatorDays}</td>
                  <td className="py-2 px-2 text-right font-bold text-teal-600">{p.buddyDays}</td>
                </tr>
              ))}
              {props.pairs.length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-400 py-4">No active pairs</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* User table */}
      <Card
        title="Users (anonymised)"
        description="Per-user activity status. 'never' = onboarding cliff — signed up but never checked in (the biggest fixable leak right now). 'lapsed' = was engaged, then stopped (push notifications would catch most of these). 'engaged' = your core users. Sorted by days active so power users surface first."
        health={usersH}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase tracking-wide text-[10px]">
                <th className="text-left py-2 px-2">ID</th>
                <th className="text-left py-2 px-2">Signed up</th>
                <th className="text-right py-2 px-2">Days active</th>
                <th className="text-left py-2 px-2">Last</th>
                <th className="text-left py-2 px-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {props.users.map(u => (
                <tr key={u.anonId} className="border-t border-gray-100">
                  <td className="py-2 px-2 font-mono text-gray-700">{u.anonId}</td>
                  <td className="py-2 px-2 text-gray-600">{u.signedUp}</td>
                  <td className="py-2 px-2 text-right font-bold text-gray-700">{u.daysActive}</td>
                  <td className="py-2 px-2 text-gray-600">{u.lastActive ?? '—'}</td>
                  <td className="py-2 px-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      u.status === 'engaged' ? 'bg-teal-100 text-teal-700' :
                      u.status === 'lapsed' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {u.status === 'never_activated' ? 'never' : u.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-3">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-black text-gray-800 mt-1">{value}</p>
    </div>
  )
}

function Card({
  title, description, health, children,
}: {
  title: string
  description?: string
  health?: Health
  children?: React.ReactNode
}) {
  const badge = health ? STATUS_BADGES[health.status] : null
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-black text-gray-400 uppercase tracking-wide">{title}</p>
        {badge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${badge.className}`}>
            {badge.label}
          </span>
        )}
      </div>
      {description && (
        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{description}</p>
      )}
      {health && health.status !== 'healthy' && health.advice && (
        <div className={`text-xs mt-2 px-3 py-2 rounded-lg leading-relaxed ${
          health.status === 'action'
            ? 'bg-red-50 border-l-2 border-red-400 text-red-800'
            : 'bg-amber-50 border-l-2 border-amber-400 text-amber-800'
        }`}>
          <strong className="block mb-0.5 text-[11px] uppercase tracking-wide">
            {health.status === 'action' ? '🔴 Action needed' : '🟡 Watch'}
          </strong>
          {health.advice}
        </div>
      )}
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

function pct(num: number, denom: number): string {
  if (denom === 0) return '0%'
  return `${Math.round((num / denom) * 100)}%`
}
