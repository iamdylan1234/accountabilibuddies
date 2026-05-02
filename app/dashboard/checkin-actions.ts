'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function toggleCheckIn(goalId: string, date: string): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Use select() without .single() — .single() errors on 0 or 2+ rows, which
  // silently falls through to the insert branch and re-creates a deleted check-in.
  const { data: existing, error: selectError } = await supabase
    .from('check_ins')
    .select('id')
    .eq('goal_id', goalId)
    .eq('user_id', user.id)
    .eq('date', date)

  if (selectError) {
    console.error('[toggleCheckIn] select error:', selectError)
    return { error: selectError.message }
  }

  if (existing && existing.length > 0) {
    // Delete ALL matching rows (handles any duplicates that crept in)
    const { error: deleteError } = await supabase
      .from('check_ins')
      .delete()
      .eq('goal_id', goalId)
      .eq('user_id', user.id)
      .eq('date', date)
    if (deleteError) {
      console.error('[toggleCheckIn] delete error:', deleteError)
      return { error: deleteError.message }
    }
  } else {
    const { error: insertError } = await supabase.from('check_ins').insert({
      goal_id: goalId,
      user_id: user.id,
      date,
      completed: true,
    })
    if (insertError) {
      console.error('[toggleCheckIn] insert error:', insertError)
      return { error: insertError.message }
    }
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

export async function logValue(goalId: string, date: string, value: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Allow multiple log entries per day for cumulative goals (e.g. two runs)
  const { error } = await supabase.from('check_ins').insert({
    goal_id: goalId,
    user_id: user.id,
    date,
    completed: true,
    value,
  })
  if (error) console.error('[logValue] error:', error)
  revalidatePath('/dashboard')
}
