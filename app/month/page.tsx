import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProgressView from '@/components/month/ProgressView'
import type { ChallengeWithProfiles, Profile } from '@/types/database'

export default async function MonthPage() {
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
  const today = new Date().toISOString().split('T')[0]

  const start = new Date(typedChallenge.start_date)
  const totalDays = Math.floor(
    (new Date(typedChallenge.end_date).getTime() - start.getTime()) / 86400000
  ) + 1

  const buddyId = typedChallenge.creator_id === user.id
    ? typedChallenge.buddy_id
    : typedChallenge.creator_id

  const [goalsRes, myCheckInsRes, buddyCheckInsRes, myProfileRes] = await Promise.all([
    supabase.from('goals').select('*').eq('challenge_id', typedChallenge.id),
    supabase.from('check_ins').select('*').eq('user_id', user.id),
    supabase.from('check_ins').select('*').eq('user_id', buddyId!),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
  ])

  const allGoals = goalsRes.data ?? []
  const myGoals = allGoals.filter(g => g.user_id === user.id)
  const buddyGoals = allGoals.filter(g => g.user_id === buddyId)
  const buddyProfile = (typedChallenge.creator_id === user.id
    ? typedChallenge.buddy
    : typedChallenge.creator) as Profile | null

  return (
    <ProgressView
      myGoals={myGoals}
      buddyGoals={buddyGoals}
      myCheckIns={myCheckInsRes.data ?? []}
      buddyCheckIns={buddyCheckInsRes.data ?? []}
      myProfile={myProfileRes.data!}
      buddyProfile={buddyProfile}
      startDate={typedChallenge.start_date}
      endDate={typedChallenge.end_date}
      today={today}
      totalDays={totalDays}
    />
  )
}
