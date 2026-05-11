import { createAdminClient } from '@/lib/supabase/admin'

const admin = () => createAdminClient()

export interface TrajectoryPoint { date: string; checkins: number; users: number }
export interface FunnelStage { label: string; count: number }
export interface PairHealth { anonCreator: string; anonBuddy: string; creatorDays: number; buddyDays: number; goalCount: number; daysSinceStart: number }
export interface GoalMixRow { type: string; count: number; avgCompletion: number }
export interface UserRow { anonId: string; signedUp: string; daysActive: number; lastActive: string | null; status: 'engaged' | 'lapsed' | 'never_activated' }
export interface HeroKpis { totalUsers: number; activatedUsers: number; dau: number; wau: number; mau: number; checkinsLast24h: number; checkinsLast7d: number }

function anonId(uuid: string): string {
  return `usr_${uuid.slice(0, 8)}`
}

export async function getHeroKpis(): Promise<HeroKpis> {
  const s = admin()
  const d1 = new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10)
  const d7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const d30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const [totalUsersRes, dauRes, wauRes, mauRes, checkins24hRes, checkins7dRes] = await Promise.all([
    s.from('profiles').select('id', { count: 'exact', head: true }),
    s.from('check_ins').select('user_id').gte('date', d1).eq('completed', true),
    s.from('check_ins').select('user_id').gte('date', d7).eq('completed', true),
    s.from('check_ins').select('user_id').gte('date', d30).eq('completed', true),
    s.from('check_ins').select('id', { count: 'exact', head: true }).gte('date', d1).eq('completed', true),
    s.from('check_ins').select('id', { count: 'exact', head: true }).gte('date', d7).eq('completed', true),
  ])

  // Activated = users with ≥1 check-in. Compute client-side since RPC may not exist.
  const { data: anyCheckin } = await s.from('check_ins').select('user_id').eq('completed', true)
  const activatedUsers = new Set((anyCheckin ?? []).map(r => r.user_id)).size

  return {
    totalUsers: totalUsersRes.count ?? 0,
    activatedUsers,
    dau: new Set((dauRes.data ?? []).map(r => r.user_id)).size,
    wau: new Set((wauRes.data ?? []).map(r => r.user_id)).size,
    mau: new Set((mauRes.data ?? []).map(r => r.user_id)).size,
    checkinsLast24h: checkins24hRes.count ?? 0,
    checkinsLast7d: checkins7dRes.count ?? 0,
  }
}

export async function getTrajectory(days = 30): Promise<TrajectoryPoint[]> {
  const s = admin()
  const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const { data } = await s.from('check_ins').select('date, user_id').gte('date', startDate).eq('completed', true)
  if (!data) return []

  const byDate = new Map<string, Set<string>>()
  const checkinsCount = new Map<string, number>()
  for (const row of data) {
    if (!byDate.has(row.date)) byDate.set(row.date, new Set())
    byDate.get(row.date)!.add(row.user_id)
    checkinsCount.set(row.date, (checkinsCount.get(row.date) ?? 0) + 1)
  }

  // Fill every date in range (including zeros)
  const out: TrajectoryPoint[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10)
    out.push({ date: d, checkins: checkinsCount.get(d) ?? 0, users: byDate.get(d)?.size ?? 0 })
  }
  return out
}

export async function getPairHealth(): Promise<PairHealth[]> {
  const s = admin()
  const { data: challenges } = await s.from('challenge_months')
    .select('id, creator_id, buddy_id, start_date, status')
    .in('status', ['active', 'pending'])
    .not('buddy_id', 'is', null)

  if (!challenges) return []

  const results: PairHealth[] = []
  for (const c of challenges) {
    if (!c.buddy_id) continue
    const { data: goals } = await s.from('goals').select('id, user_id').eq('challenge_id', c.id)
    const { data: checkins } = await s.from('check_ins').select('date, user_id').in('goal_id', (goals ?? []).map(g => g.id)).eq('completed', true)
    const creatorDays = new Set((checkins ?? []).filter(c2 => c2.user_id === c.creator_id).map(c2 => c2.date)).size
    const buddyDays = new Set((checkins ?? []).filter(c2 => c2.user_id === c.buddy_id).map(c2 => c2.date)).size
    const daysSinceStart = Math.floor((Date.now() - new Date(c.start_date).getTime()) / 86400000)
    results.push({
      anonCreator: anonId(c.creator_id),
      anonBuddy: anonId(c.buddy_id),
      creatorDays,
      buddyDays,
      goalCount: (goals ?? []).length,
      daysSinceStart,
    })
  }
  return results.sort((a, b) => (b.creatorDays + b.buddyDays) - (a.creatorDays + a.buddyDays))
}

export async function getGoalMix(): Promise<GoalMixRow[]> {
  const s = admin()
  const { data: goals } = await s.from('goals').select('id, type, target_count, challenge_id')
  if (!goals) return []
  const { data: checkins } = await s.from('check_ins').select('goal_id, completed')

  const completionMap = new Map<string, number>()
  for (const c of (checkins ?? []).filter(c => c.completed)) {
    completionMap.set(c.goal_id, (completionMap.get(c.goal_id) ?? 0) + 1)
  }

  const byType = new Map<string, { count: number; totalCompletion: number; totalWithBaseline: number }>()
  for (const g of goals) {
    if (!byType.has(g.type)) byType.set(g.type, { count: 0, totalCompletion: 0, totalWithBaseline: 0 })
    const entry = byType.get(g.type)!
    entry.count++
    const done = completionMap.get(g.id) ?? 0
    if (g.type === 'frequency' || g.type === 'cumulative') {
      if (g.target_count && g.target_count > 0) {
        entry.totalCompletion += Math.min(100, (done / g.target_count) * 100)
        entry.totalWithBaseline++
      }
    } else if (g.type === 'daily') {
      // crude proxy: completion = checkins (no denominator without challenge dates)
      entry.totalCompletion += done > 0 ? Math.min(100, done * 10) : 0
      entry.totalWithBaseline++
    } else if (g.type === 'milestone') {
      entry.totalCompletion += done > 0 ? 100 : 0
      entry.totalWithBaseline++
    }
  }

  return Array.from(byType.entries()).map(([type, v]) => ({
    type,
    count: v.count,
    avgCompletion: v.totalWithBaseline > 0 ? Math.round(v.totalCompletion / v.totalWithBaseline) : 0,
  }))
}

export async function getFunnel(): Promise<FunnelStage[]> {
  const s = admin()
  const [profilesRes, challengesRes, goalsRes, checkinsRes] = await Promise.all([
    s.from('profiles').select('id'),
    s.from('challenge_months').select('creator_id, buddy_id'),
    s.from('goals').select('user_id'),
    s.from('check_ins').select('user_id, date').eq('completed', true),
  ])

  const allUsers = new Set((profilesRes.data ?? []).map(p => p.id))
  const inChallenge = new Set<string>()
  for (const c of challengesRes.data ?? []) {
    if (c.creator_id) inChallenge.add(c.creator_id)
    if (c.buddy_id) inChallenge.add(c.buddy_id)
  }
  const withGoals = new Set((goalsRes.data ?? []).map(g => g.user_id))
  const firstCheckin = new Set((checkinsRes.data ?? []).map(c => c.user_id))
  const recentCutoff = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
  const activeRecent = new Set((checkinsRes.data ?? []).filter(c => c.date >= recentCutoff).map(c => c.user_id))

  // Suppress unused variable warning — allUsers drives the first stage count
  void allUsers

  return [
    { label: 'Signed up', count: (profilesRes.data ?? []).length },
    { label: 'In a challenge', count: inChallenge.size },
    { label: 'Set goals', count: withGoals.size },
    { label: 'First check-in', count: firstCheckin.size },
    { label: 'Active (3d)', count: activeRecent.size },
  ]
}

export async function getUserTable(): Promise<UserRow[]> {
  const s = admin()
  const [profilesRes, checkinsRes] = await Promise.all([
    s.from('profiles').select('id, created_at'),
    s.from('check_ins').select('user_id, date').eq('completed', true),
  ])

  const checkinsByUser = new Map<string, { days: Set<string>; last: string | null }>()
  for (const c of checkinsRes.data ?? []) {
    if (!checkinsByUser.has(c.user_id)) checkinsByUser.set(c.user_id, { days: new Set(), last: null })
    const entry = checkinsByUser.get(c.user_id)!
    entry.days.add(c.date)
    if (!entry.last || c.date > entry.last) entry.last = c.date
  }

  const recentCutoff = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)

  return (profilesRes.data ?? []).map(p => {
    const data = checkinsByUser.get(p.id)
    const daysActive = data?.days.size ?? 0
    const lastActive = data?.last ?? null
    let status: UserRow['status']
    if (daysActive === 0) status = 'never_activated'
    else if (lastActive && lastActive >= recentCutoff) status = 'engaged'
    else status = 'lapsed'
    return {
      anonId: anonId(p.id),
      signedUp: p.created_at.slice(0, 10),
      daysActive,
      lastActive,
      status,
    }
  }).sort((a, b) => (b.daysActive - a.daysActive))
}
