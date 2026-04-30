'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createChallenge(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const monthName = formData.get('month_name') as string
  const startDate = formData.get('start_date') as string

  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + 29)
  const endDate = end.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('challenge_months')
    .insert({
      creator_id: user.id,
      month_name: monthName,
      start_date: startDate,
      end_date: endDate,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  redirect(`/setup?challenge=${data.id}`)
}
