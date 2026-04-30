import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ScoreSummary from '@/components/wrap-up/ScoreSummary'
import type { ChallengeWithProfiles, Profile } from '@/types/database'

export default async function WrapUpPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: challenge } = await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .in('status', ['active', 'completed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!challenge) redirect('/dashboard')

  const typedChallenge = challenge as unknown as ChallengeWithProfiles
  const buddyId = typedChallenge.creator_id === user.id
    ? typedChallenge.buddy_id
    : typedChallenge.creator_id

  const totalDays = Math.floor(
    (new Date(typedChallenge.end_date).getTime() - new Date(typedChallenge.start_date).getTime()) / 86400000
  ) + 1

  const [goalsRes, myCheckInsRes, buddyCheckInsRes, myProfileRes] = await Promise.all([
    supabase.from('goals').select('*').eq('challenge_id', typedChallenge.id),
    supabase.from('check_ins').select('*').eq('user_id', user.id),
    supabase.from('check_ins').select('*').eq('user_id', buddyId!),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
  ])

  if (!myProfileRes.data) redirect('/auth/login')
  if (!buddyId) redirect('/dashboard')

  const allGoals = goalsRes.data ?? []
  const buddyProfile = (typedChallenge.creator_id === user.id
    ? typedChallenge.buddy
    : typedChallenge.creator) as Profile | null

  return (
    <ScoreSummary
      myGoals={allGoals.filter(g => g.user_id === user.id)}
      buddyGoals={allGoals.filter(g => g.user_id === buddyId)}
      myCheckIns={myCheckInsRes.data ?? []}
      buddyCheckIns={buddyCheckInsRes.data ?? []}
      myProfile={myProfileRes.data}
      buddyProfile={buddyProfile}
      totalDays={totalDays}
      challengeName={typedChallenge.month_name}
      isComplete={typedChallenge.status === 'completed'}
    />
  )
}
