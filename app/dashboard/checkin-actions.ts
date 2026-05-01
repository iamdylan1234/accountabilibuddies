'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function toggleCheckIn(goalId: string, date: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: existing } = await supabase
    .from('check_ins')
    .select('id')
    .eq('goal_id', goalId)
    .eq('user_id', user.id)
    .eq('date', date)
    .single()

  if (existing) {
    const { error } = await supabase.from('check_ins').delete().eq('id', existing.id)
    if (error) console.error('[toggleCheckIn] delete error:', error)
  } else {
    const { error } = await supabase.from('check_ins').insert({
      goal_id: goalId,
      user_id: user.id,
      date,
      completed: true,
    })
    if (error) console.error('[toggleCheckIn] insert error:', error)
  }

  revalidatePath('/dashboard')
}

export async function addReaction(checkInId: string, emoji: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Verify the check-in belongs to someone else (can't react to your own)
  const { data: checkIn } = await supabase
    .from('check_ins')
    .select('user_id')
    .eq('id', checkInId)
    .single()
  if (!checkIn || checkIn.user_id === user.id) return

  // Upsert: replace existing reaction if there is one
  await supabase.from('reactions').upsert({
    check_in_id: checkInId,
    from_user_id: user.id,
    emoji,
  }, { onConflict: 'check_in_id,from_user_id' })

  revalidatePath('/dashboard')
}
