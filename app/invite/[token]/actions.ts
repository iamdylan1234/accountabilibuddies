'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function acceptInvite(token: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/signup?next=/invite/${token}`)

  const { data: challenge } = await supabase
    .from('challenge_months')
    .select('*')
    .eq('invite_token', token)
    .eq('status', 'pending')
    .single()

  if (!challenge) throw new Error('Invite not found or already used.')
  if (challenge.creator_id === user.id) throw new Error('You cannot join your own challenge.')

  const { error } = await supabase
    .from('challenge_months')
    .update({ buddy_id: user.id })
    .eq('id', challenge.id)

  if (error) throw new Error(error.message)

  redirect(`/setup?challenge=${challenge.id}`)
}
