'use server'

import { createClient } from '@/lib/supabase/server'
import { sendRematchProposalPush } from '@/lib/push/send'
import { rematchDates } from '@/lib/rematch'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Server-side "today" fallback for placeholder dates only (real dates use the
// client-supplied local today on accept). UTC is fine for a never-read placeholder.
function todayLocalFallback(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Propose a rematch of a finished challenge. Creates a forming challenge
 * (pending, creator = me, proposed_to = my last buddy, buddy_id null,
 * rematch_of = finished). Idempotent via UNIQUE(rematch_of): if a proposal for
 * that finished challenge already exists, route to it (the "both tapped Run it
 * back" case → the second tapper accepts the first).
 */
export async function proposeRematch(finishedChallengeId: string): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  const { data: finished } = await supabase
    .from('challenge_months')
    .select('id, creator_id, buddy_id, status')
    .eq('id', finishedChallengeId)
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .maybeSingle()
  if (!finished) return { error: 'Challenge not found.' }
  if (finished.status !== 'completed') return { error: 'You can only rematch a finished challenge.' }

  const { data: existing } = await supabase
    .from('challenge_months')
    .select('id')
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .in('status', ['active', 'pending'])
    .limit(1)
    .maybeSingle()
  if (existing) return { error: 'Finish or leave your current challenge first.' }

  const buddyId = finished.creator_id === user.id ? finished.buddy_id : finished.creator_id
  if (!buddyId) return { error: 'That challenge had no buddy to rematch.' }

  const { data: already } = await supabase
    .from('challenge_months')
    .select('id, proposed_to')
    .eq('rematch_of', finishedChallengeId)
    .maybeSingle()
  if (already) {
    if (already.proposed_to === user.id) return acceptRematch(already.id, todayLocalFallback())
    revalidatePath('/dashboard')
    redirect('/dashboard')
  }

  const { data: created, error } = await supabase
    .from('challenge_months')
    .insert({
      creator_id: user.id,
      buddy_id: null,
      proposed_to: buddyId,
      rematch_of: finishedChallengeId,
      month_name: 'Rematch',
      start_date: todayLocalFallback(),
      end_date: todayLocalFallback(),
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') { revalidatePath('/dashboard'); redirect('/dashboard') }
    return { error: `Couldn't propose rematch: ${error.message}` }
  }

  await sendRematchProposalPush(user.id, buddyId)
  revalidatePath('/dashboard')
  redirect(`/setup?challenge=${created.id}`)
}

/**
 * Accept a rematch proposed to me. Attaches me as buddy, locks the dates
 * (start = my local tomorrow, +29) and the month-flavored name, clears
 * proposed_to. Both buddies then set goals; the existing on_goal_inserted DB
 * trigger flips status → active once both have ≥5 goals. `today` is the
 * accepter's local YYYY-MM-DD (sent from the client).
 */
export async function acceptRematch(challengeId: string, today: string): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return { error: 'Invalid date.' }

  const { data: forming } = await supabase
    .from('challenge_months')
    .select('id, proposed_to, status, buddy_id')
    .eq('id', challengeId)
    .maybeSingle()
  if (!forming || forming.status !== 'pending' || forming.proposed_to !== user.id || forming.buddy_id) {
    return { error: 'This rematch is no longer available.' }
  }

  const { start_date, end_date, month_name } = rematchDates(today)
  const { error } = await supabase
    .from('challenge_months')
    .update({ buddy_id: user.id, proposed_to: null, start_date, end_date, month_name })
    .eq('id', challengeId)
    .eq('proposed_to', user.id)
  if (error) return { error: `Couldn't accept: ${error.message}` }

  revalidatePath('/dashboard')
  redirect(`/setup?challenge=${challengeId}`)
}

/** Decline a rematch proposed to me — deletes the forming challenge. */
export async function declineRematch(challengeId: string): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }
  const { error } = await supabase
    .from('challenge_months')
    .delete()
    .eq('id', challengeId)
    .eq('proposed_to', user.id)
    .eq('status', 'pending')
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
}

/** Withdraw a rematch I proposed — deletes the forming challenge. */
export async function withdrawRematch(challengeId: string): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }
  const { error } = await supabase
    .from('challenge_months')
    .delete()
    .eq('id', challengeId)
    .eq('creator_id', user.id)
    .not('proposed_to', 'is', null)
    .eq('status', 'pending')
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  redirect('/dashboard')
}
