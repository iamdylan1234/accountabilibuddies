'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface GoalUpdate {
  title: string
  schedule_days: number[] | null
  catch_up: boolean
}

export async function updateGoal(goalId: string, updates: GoalUpdate) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('goals')
    .update({
      title: updates.title,
      schedule_days: updates.schedule_days,
      catch_up: updates.catch_up,
    })
    .eq('id', goalId)
    .eq('user_id', user.id)   // users can only edit their own goals

  if (error) throw new Error(error.message)
  revalidatePath('/wrap-up')
}
