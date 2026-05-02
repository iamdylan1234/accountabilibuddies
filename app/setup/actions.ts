'use server'

import { createClient } from '@/lib/supabase/server'
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

export async function saveGoals(challengeId: string, goals: GoalDraft[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: challenge } = await supabase
    .from('challenge_months').select('id, status')
    .eq('id', challengeId)
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .single()

  if (!challenge) throw new Error('Challenge not found or access denied.')
  if (challenge.status === 'active') throw new Error('Goals are locked once the challenge is active.')

  await supabase.from('goals').delete()
    .eq('challenge_id', challengeId).eq('user_id', user.id)

  const rows = goals.map(g => ({
    challenge_id: challengeId,
    user_id: user.id,
    title: g.title,
    type: g.type,
    target_count: (g.type === 'frequency' || g.type === 'cumulative')
      ? (parseInt(g.target_count) || null)
      : null,
    target_unit: g.target_unit.trim() || null,
    schedule_dates: g.schedule_dates.length > 0 ? g.schedule_dates : null,
    catch_up: g.catch_up,
  }))

  const { error } = await supabase.from('goals').insert(rows)
  if (error) throw new Error(error.message)
  redirect('/dashboard')
}
