import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createChallenge } from './actions'
import CopyButton from '@/components/layout/CopyButton'
import DashboardClient from '@/components/dashboard/DashboardClient'
import PendingChallengeActions from '@/components/dashboard/PendingChallengeActions'
import type { ChallengeWithProfiles } from '@/types/database'
import { BRAND_GRADIENT } from '@/lib/brand'

// Force dynamic rendering — this page depends on the authenticated user's data
// and must not be cached at the route level. Without this, mobile browsers
// (esp. Safari iOS in PWA mode) can serve a stale "no challenge" version
// to a user who has just created one.
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Prefer active challenge; fall back to pending only if no active challenge exists.
  // Use .maybeSingle() (not .single()) — .single() errors on 0 rows in some Postgrest
  // edge cases and the error is harder to surface. maybeSingle returns null cleanly.
  const { data: activeChallenge, error: activeErr } = await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (activeErr) console.error('[DashboardPage] active challenge query failed:', activeErr)

  const pendingResult = !activeChallenge ? await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() : { data: null, error: null }

  const pendingChallenge = pendingResult.data
  if (pendingResult.error) {
    console.error('[DashboardPage] pending challenge query failed:', pendingResult.error)
  }

  const challenge = activeChallenge ?? pendingChallenge

  // No challenge yet — show create form
  if (!challenge) {
    const today = new Date().toISOString().split('T')[0]
    return (
      <div className="max-w-md mx-auto mt-20 px-6">
        <h1 className="text-3xl font-black text-gray-900 mb-2">Start a challenge</h1>
        <p className="text-gray-500 mb-8">Create a challenge month and invite your buddy.</p>
        <form action={createChallenge} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Challenge name</label>
            <input
              name="month_name"
              type="text"
              required
              defaultValue="May Challenge"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Start date</label>
            <input
              name="start_date"
              type="date"
              required
              defaultValue={today}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-xl font-bold text-white text-sm"
            style={{ background: BRAND_GRADIENT }}
          >
            Create challenge →
          </button>
        </form>
      </div>
    )
  }

  const typedChallenge = challenge as unknown as ChallengeWithProfiles

  // Challenge exists but no buddy yet
  if (typedChallenge.status === 'pending') {
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${typedChallenge.invite_token}`
    return (
      <div className="max-w-md mx-auto mt-20 px-6">
        <h1 className="text-3xl font-black text-gray-900 mb-2">{typedChallenge.month_name}</h1>
        <p className="text-gray-500 mb-8">Waiting for your buddy to join. Share this link:</p>
        <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
          <span className="text-sm text-gray-700 break-all flex-1">{inviteUrl}</span>
          <CopyButton text={inviteUrl} />
        </div>
        <p className="text-sm text-gray-400 mt-4">
          Once your buddy joins and sets their goals, the challenge begins.
        </p>
        <PendingChallengeActions challengeId={typedChallenge.id} />
      </div>
    )
  }

  // Active challenge — fetch goals and check-ins, render full dashboard
  // today and dayNumber are computed client-side so they reflect the user's local timezone
  const totalDays = Math.floor(
    (new Date(typedChallenge.end_date).getTime() - new Date(typedChallenge.start_date).getTime()) / 86400000
  ) + 1

  const buddyId = typedChallenge.creator_id === user.id
    ? typedChallenge.buddy_id
    : typedChallenge.creator_id

  if (!buddyId) redirect('/dashboard')

  const [goalsRes, myCheckInsRes, buddyCheckInsRes] = await Promise.all([
    supabase.from('goals').select('*').eq('challenge_id', typedChallenge.id),
    supabase.from('check_ins').select('*')
      .eq('user_id', user.id)
      .gte('date', typedChallenge.start_date)
      .lte('date', typedChallenge.end_date),
    supabase.from('check_ins').select('*')
      .eq('user_id', buddyId!)
      .gte('date', typedChallenge.start_date)
      .lte('date', typedChallenge.end_date),
  ])

  const allCheckInIds = [
    ...(myCheckInsRes.data ?? []),
    ...(buddyCheckInsRes.data ?? []),
  ].map(c => c.id)

  const reactionsRes = allCheckInIds.length > 0
    ? await supabase.from('reactions').select('*').in('check_in_id', allCheckInIds)
    : { data: [] }

  const allGoals = goalsRes.data ?? []
  const myGoals = allGoals.filter(g => g.user_id === user.id)
  const buddyGoals = allGoals.filter(g => g.user_id === buddyId)

  return (
    <DashboardClient
      challenge={typedChallenge}
      myGoals={myGoals}
      buddyGoals={buddyGoals}
      myCheckIns={myCheckInsRes.data ?? []}
      buddyCheckIns={buddyCheckInsRes.data ?? []}
      reactions={reactionsRes.data ?? []}
      myId={user.id}
      startDate={typedChallenge.start_date}
      totalDays={totalDays}
    />
  )
}
