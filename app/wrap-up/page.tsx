import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ScoreSummary from '@/components/wrap-up/ScoreSummary'
import type { ChallengeWithProfiles, Profile } from '@/types/database'

interface Props {
  searchParams: Promise<{ challenge?: string }>
}

export default async function WrapUpPage({ searchParams }: Props) {
  const { challenge: challengeId } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // If a specific challenge ID is provided, load that challenge.
  // Otherwise, load the most recent active/completed challenge.
  let challenge: ChallengeWithProfiles | null = null

  if (challengeId) {
    const { data } = await supabase
      .from('challenge_months')
      .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
      .eq('id', challengeId)
      .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
      .single()
    challenge = (data ?? null) as ChallengeWithProfiles | null
  } else {
    const { data } = await supabase
      .from('challenge_months')
      .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
      .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
      .in('status', ['active', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    challenge = (data ?? null) as ChallengeWithProfiles | null
  }

  if (!challenge) redirect('/dashboard')

  const buddyId = challenge.creator_id === user.id
    ? challenge.buddy_id
    : challenge.creator_id

  if (!buddyId) redirect('/dashboard')

  const totalDays = Math.floor(
    (new Date(challenge.end_date).getTime() - new Date(challenge.start_date).getTime()) / 86400000
  ) + 1
  const today = new Date().toISOString().split('T')[0]

  const [goalsRes, myCheckInsRes, buddyCheckInsRes, myProfileRes, pendingRes] = await Promise.all([
    supabase.from('goals').select('*').eq('challenge_id', challenge.id),
    supabase.from('check_ins').select('*').eq('user_id', user.id)
      .gte('date', challenge.start_date)
      .lte('date', challenge.end_date),
    supabase.from('check_ins').select('*').eq('user_id', buddyId)
      .gte('date', challenge.start_date)
      .lte('date', challenge.end_date),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('goal_change_requests').select('*')
      .eq('challenge_id', challenge.id).eq('status', 'pending'),
  ])

  if (!myProfileRes.data) redirect('/auth/login')

  const allGoals = goalsRes.data ?? []
  const buddyProfile = (challenge.creator_id === user.id
    ? challenge.buddy
    : challenge.creator) as Profile | null

  // Historical mode: viewing a past challenge from profile page
  const isHistorical = !!challengeId

  return (
    <ScoreSummary
      myGoals={allGoals.filter(g => g.user_id === user.id)}
      buddyGoals={allGoals.filter(g => g.user_id === buddyId)}
      myCheckIns={myCheckInsRes.data ?? []}
      buddyCheckIns={buddyCheckInsRes.data ?? []}
      myProfile={myProfileRes.data}
      buddyProfile={buddyProfile}
      totalDays={totalDays}
      challengeName={challenge.month_name}
      isComplete={challenge.status === 'completed'}
      startDate={challenge.start_date}
      endDate={challenge.end_date}
      today={today}
      challengeId={challenge.id}
      myId={user.id}
      pendingRequests={isHistorical ? [] : (pendingRes.data ?? [])}
      isHistorical={isHistorical}
      backHref={isHistorical ? '/profile' : undefined}
    />
  )
}
