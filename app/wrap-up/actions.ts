'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

export async function submitGoalChangeRequest(
  goalId: string,
  challengeId: string,
  proposed: {
    title: string
    type: GoalType
    target_count: number | null
    target_unit: string | null
    schedule_dates: string[] | null
    catch_up: boolean
  }
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Cancel any existing pending request from this user for this goal
  await supabase.from('goal_change_requests')
    .update({ status: 'rejected' })
    .eq('goal_id', goalId)
    .eq('requester_id', user.id)
    .eq('status', 'pending')

  const { error } = await supabase.from('goal_change_requests').insert({
    goal_id: goalId,
    challenge_id: challengeId,
    requester_id: user.id,
    proposed_title: proposed.title,
    proposed_type: proposed.type,
    proposed_target_count: proposed.target_count,
    proposed_target_unit: proposed.target_unit,
    proposed_schedule_dates: proposed.schedule_dates,
    proposed_catch_up: proposed.catch_up,
    status: 'pending',
  })
  if (error) return { error: error.message }
  revalidatePath('/wrap-up')
}

export async function approveChange(requestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: req } = await supabase.from('goal_change_requests')
    .select('*').eq('id', requestId).eq('status', 'pending').single()
  if (!req) throw new Error('Request not found or already resolved')
  if (req.requester_id === user.id) throw new Error('Cannot approve your own change request')

  // Use admin client to bypass RLS — the approver doesn't own the goal
  const admin = createAdminClient()
  await admin.from('goals').update({
    title: req.proposed_title,
    type: req.proposed_type,
    target_count: req.proposed_target_count,
    target_unit: req.proposed_target_unit,
    schedule_dates: req.proposed_schedule_dates,
    catch_up: req.proposed_catch_up,
  }).eq('id', req.goal_id)

  await supabase.from('goal_change_requests')
    .update({ status: 'approved' }).eq('id', requestId)

  revalidatePath('/wrap-up')
  revalidatePath('/dashboard')
  revalidatePath('/week')
}

export async function rejectChange(requestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: req } = await supabase.from('goal_change_requests')
    .select('requester_id').eq('id', requestId).single()
  if (!req) throw new Error('Request not found')
  if (req.requester_id === user.id) throw new Error('Cannot reject your own request')

  await supabase.from('goal_change_requests')
    .update({ status: 'rejected' }).eq('id', requestId)

  revalidatePath('/wrap-up')
  revalidatePath('/dashboard')
  revalidatePath('/week')
}
