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

  async function handleSave(goals: {
    title: string; type: string; target_count: string
    target_unit: string; schedule_dates: string[]; catch_up: boolean
  }[]) {
    'use server'
    await saveGoals(challengeId!, goals as any)
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
        <p className="text-white/70 text-sm mt-1">Add 5–8 goals. You can&apos;t change these once your buddy joins.</p>
      </div>
      <GoalSetupForm
        challengeId={challengeId}
        challengeStartDate={challenge.start_date}
        challengeEndDate={challenge.end_date}
        existingGoals={existingGoals ?? []}
        onSubmit={handleSave}
      />
    </div>
  )
}
