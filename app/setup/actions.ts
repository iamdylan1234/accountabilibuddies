'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { GoalType } from '@/types/database'

interface GoalDraft {
  title: string
  type: GoalType
  target_count: string
  target_unit: string
  schedule_dates: string[]
  catch_up: boolean
}

export async function saveGoals(
  challengeId: string,
  goals: GoalDraft[],
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in. Please log in again.' }

  const { data: challenge, error: challengeError } = await supabase
    .from('challenge_months').select('id, status')
    .eq('id', challengeId)
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .maybeSingle()

  if (challengeError) {
    console.error('[saveGoals] challenge fetch error:', challengeError)
    return { error: `Could not load challenge: ${challengeError.message}` }
  }
  if (!challenge) {
    return { error: 'Challenge not found — it may have been cancelled. Refresh and try again.' }
  }
  if (challenge.status === 'active') {
    return { error: 'Goals are locked once the challenge is active.' }
  }

  const { error: deleteError } = await supabase.from('goals').delete()
    .eq('challenge_id', challengeId).eq('user_id', user.id)

  if (deleteError) {
    console.error('[saveGoals] delete error:', deleteError)
    return { error: `Could not clear old goals: ${deleteError.message}` }
  }

  const rows = goals.map(g => ({
    challenge_id: challengeId,
    user_id: user.id,
    title: g.title.trim().slice(0, 200),
    type: g.type,
    target_count: (g.type === 'frequency' || g.type === 'cumulative')
      ? (parseInt(g.target_count) || null)
      : null,
    target_unit: g.target_unit.trim() || null,
    schedule_dates: g.schedule_dates.length > 0 ? g.schedule_dates : null,
    catch_up: g.catch_up,
  }))

  const { error: insertError } = await supabase.from('goals').insert(rows)
  if (insertError) {
    console.error('[saveGoals] insert error:', insertError, '\nrows:', JSON.stringify(rows, null, 2))
    return { error: `Could not save goals: ${insertError.message}` }
  }

  // Invalidate the dashboard's cached render so the goals/challenge state is fresh
  // when we redirect. Without this, mobile browsers (Safari iOS PWA in particular)
  // can show the stale "create challenge" form instead of the "waiting for buddy" view.
  revalidatePath('/dashboard')
  revalidatePath('/week')
  revalidatePath('/wrap-up')
  redirect('/dashboard')
}
