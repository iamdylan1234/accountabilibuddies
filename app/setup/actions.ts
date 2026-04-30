'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { GoalType } from '@/types/database'

interface GoalDraft {
  title: string
  type: GoalType
  target_count: string
}

export async function saveGoals(challengeId: string, goals: GoalDraft[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Delete existing goals first (allows re-setup before challenge is active)
  await supabase.from('goals').delete()
    .eq('challenge_id', challengeId)
    .eq('user_id', user.id)

  const rows = goals.map(g => ({
    challenge_id: challengeId,
    user_id: user.id,
    title: g.title,
    type: g.type,
    target_count: g.type === 'frequency' ? parseInt(g.target_count) || null : null,
  }))

  const { error } = await supabase.from('goals').insert(rows)
  if (error) throw new Error(error.message)

  redirect('/dashboard')
}
