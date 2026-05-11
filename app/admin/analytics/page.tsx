import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import {
  getHeroKpis, getTrajectory, getPairHealth,
  getGoalMix, getFunnel, getUserTable,
} from '@/lib/analytics-queries'
import AnalyticsClient from './AnalyticsClient'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const admin = await requireAdmin()
  if (!admin) notFound()

  const [hero, trajectory, pairs, goalMix, funnel, users] = await Promise.all([
    getHeroKpis(),
    getTrajectory(30),
    getPairHealth(),
    getGoalMix(),
    getFunnel(),
    getUserTable(),
  ])

  return (
    <AnalyticsClient
      hero={hero}
      trajectory={trajectory}
      pairs={pairs}
      goalMix={goalMix}
      funnel={funnel}
      users={users}
      generatedAt={new Date().toISOString()}
    />
  )
}
