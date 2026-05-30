'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateName(name: string): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in. Please log in again.' }

  const trimmed = name.trim()
  if (trimmed.length === 0) return { error: 'Name cannot be empty.' }
  if (trimmed.length > 50) return { error: 'Name is too long (max 50 characters).' }

  const { error } = await supabase
    .from('profiles')
    .update({ name: trimmed })
    .eq('id', user.id)

  if (error) {
    console.error('[updateName] update failed:', error)
    return { error: `Couldn't save: ${error.message}` }
  }

  revalidatePath('/profile')
  revalidatePath('/settings')
}

export async function triggerPasswordReset(): Promise<{ error: string } | { sent: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Not signed in.' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://accountabilibuddies.app'
  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${appUrl}/auth/reset-password`,
  })

  if (error) {
    console.error('[triggerPasswordReset] failed:', error)
    return { error: `Couldn't send reset email: ${error.message}` }
  }

  return { sent: true }
}
