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
      <Card title="Engagement — last 30 days">
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
      <Card title="Funnel — drop-off by stage">
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
      <Card title="Goal mix + completion rate">
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
      <Card title="Pair health (anonymised)">
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
      <Card title="Users (anonymised)">
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-3">{title}</p>
      {children}
    </div>
  )
}

function pct(num: number, denom: number): string {
  if (denom === 0) return '0%'
  return `${Math.round((num / denom) * 100)}%`
}
