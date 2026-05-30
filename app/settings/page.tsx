import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from '@/components/settings/SettingsClient'
import type { ChallengeWithProfiles, Profile } from '@/types/database'

// Force dynamic rendering — same reasoning as /dashboard and /week.
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/auth/login')

  // Buddy lookup for the BuzzToggle (existing component needs a buddy prop).
  const { data: activeChallenge } = await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const typedActive = activeChallenge as unknown as ChallengeWithProfiles | null
  const buddy = typedActive
    ? ((typedActive.creator_id === user.id ? typedActive.buddy : typedActive.creator) as Profile | null)
    : null

  return (
    <SettingsClient
      email={user.email ?? ''}
      profile={profile}
      buddy={buddy}
      appVersion={process.env.npm_package_version ?? '0.0.0'}
    />
  )
}
