'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureProfile } from '@/lib/supabase/ensureProfile'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createChallenge(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Guarantee a profiles row exists before any FK-bearing INSERT. Without
  // this, deleting a profile out-of-band (cleanup, GDPR, etc.) leaves the
  // user able to log in but unable to create a challenge — the insert below
  // fails the creator_id FK silently. Was a real bug for Diego.
  await ensureProfile(supabase, user)

  // Idempotency: if user already has a pending challenge they created,
  // don't make a duplicate — send them to its setup page instead.
  const { data: existingPending } = await supabase
    .from('challenge_months')
    .select('id')
    .eq('creator_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingPending) {
    revalidatePath('/dashboard')
    redirect(`/setup?challenge=${existingPending.id}`)
  }

  const monthName = formData.get('month_name') as string
  const startDate = formData.get('start_date') as string

  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + 29)
  const endDate = end.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('challenge_months')
    .insert({
      creator_id: user.id,
      month_name: monthName,
      start_date: startDate,
      end_date: endDate,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('[createChallenge] insert failed:', error)
    throw new Error(`Couldn't create challenge: ${error.message}`)
  }

  // Invalidate the dashboard's cached render so the new challenge appears
  // immediately on subsequent renders (avoids stale "create form" race on mobile).
  revalidatePath('/dashboard')
  redirect(`/setup?challenge=${data.id}`)
}

export async function deleteChallenge(challengeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Only allow the creator to delete, and only while pending
  const { data: challenge } = await supabase
    .from('challenge_months')
    .select('id, creator_id, status')
    .eq('id', challengeId)
    .single()

  if (!challenge) throw new Error('Challenge not found')
  if (challenge.creator_id !== user.id) throw new Error('Only the creator can cancel this challenge')
  if (challenge.status !== 'pending') throw new Error('Only pending challenges can be cancelled')

  // Use admin client to ensure clean cascade through goals + check-ins + reactions
  // (relies on ON DELETE CASCADE FK constraints in Supabase)
  const admin = createAdminClient()
  const { error } = await admin.from('challenge_months').delete().eq('id', challengeId)
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard')
  revalidatePath('/profile')
  redirect('/dashboard')
}
