'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { GoalType } from '@/types/database'

interface GoalUpdate {
  title: string
  type: GoalType
  target_count: number | null
  target_unit: string | null
  schedule_dates: string[] | null
  catch_up: boolean
}

export async function updateGoal(goalId: string, updates: GoalUpdate) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.from('goals')
    .update({
      title: updates.title,
      type: updates.type,
      target_count: updates.target_count,
      target_unit: updates.target_unit,
      schedule_dates: updates.schedule_dates,
      catch_up: updates.catch_up,
    })
    .eq('id', goalId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/wrap-up')
}
