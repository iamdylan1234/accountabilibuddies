import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAvatarUrl } from '@/lib/avatar'
import ProfileClient from '@/components/profile/ProfileClient'
import type { ChallengeWithProfiles } from '@/types/database'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  const { data: challengesData } = await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  const challenges = (challengesData ?? []) as ChallengeWithProfiles[]
  const activeChallenge = challenges.find(c => c.status === 'active') ?? null
  const avatarUrl = getAvatarUrl(user.id, profile.avatar_style)

  return (
    <ProfileClient
      profile={profile}
      activeChallenge={activeChallenge}
      avatarUrl={avatarUrl}
    />
  )
}
