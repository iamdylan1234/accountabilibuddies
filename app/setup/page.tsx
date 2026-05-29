import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GoalSetupForm from '@/components/goals/GoalSetupForm'
import { saveGoals } from './actions'
import { BRAND_GRADIENT } from '@/lib/brand'

interface Props {
  searchParams: Promise<{ challenge?: string }>
}

export default async function SetupPage({ searchParams }: Props) {
  const params = await searchParams
  const challengeId = params.challenge
  if (!challengeId) redirect('/dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: challenge } = await supabase
    .from('challenge_months')
    .select('*')
    .eq('id', challengeId)
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .single()

  if (!challenge) redirect('/dashboard')

  const { data: existingGoals } = await supabase
    .from('goals').select('*')
    .eq('challenge_id', challengeId)
    .eq('user_id', user.id)

  // Most recent prior challenge of this user (excluding the one being set up).
  const { data: priorChallenges } = await supabase
    .from('challenge_months')
    .select('id')
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .neq('id', challengeId)
    .order('created_at', { ascending: false })
    .limit(1)

  let previousGoals: { title: string; type: string; target_count: number | null; target_unit: string | null; schedule_dates: string[] | null; catch_up: boolean }[] = []
  if (priorChallenges && priorChallenges.length > 0) {
    const { data: pg } = await supabase
      .from('goals')
      .select('title, type, target_count, target_unit, schedule_dates, catch_up')
      .eq('challenge_id', priorChallenges[0].id)
      .eq('user_id', user.id)
    previousGoals = pg ?? []
  }

  async function handleSave(goals: {
    title: string; type: string; target_count: string
    target_unit: string; schedule_dates: string[]; catch_up: boolean
  }[]) {
    'use server'
    return await saveGoals(challengeId!, goals as any)
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <div
        className="rounded-2xl p-6 mb-8 text-white"
        style={{ background: BRAND_GRADIENT }}
      >
        <p className="text-sm font-semibold opacity-80 uppercase tracking-wide mb-1">
          {challenge.month_name}
        </p>
        <h1 className="text-2xl font-black">Set your goals</h1>
        <p className="text-white/70 text-sm mt-1">Add 5–8 goals. You can change these any time before the challenge starts.</p>
      </div>
      <GoalSetupForm
        challengeId={challengeId}
        challengeStartDate={challenge.start_date}
        challengeEndDate={challenge.end_date}
        existingGoals={existingGoals ?? []}
        previousGoals={previousGoals}
        onSubmit={handleSave}
      />
    </div>
  )
}
