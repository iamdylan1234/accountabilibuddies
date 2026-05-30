'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
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

export async function deleteAccount(confirmation: string): Promise<{ error: string } | never> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  // Server-side belt: client already requires typing DELETE.
  if (confirmation !== 'DELETE') {
    return { error: 'Confirmation text does not match. Type DELETE exactly.' }
  }

  const admin = createAdminClient()

  // Explicit cleanup: goal_change_requests.requester_id lacks ON DELETE CASCADE
  // (per the 2026-05-30 cascade audit), so removing the auth user would fail
  // with a FK violation if the user has any change requests. This delete is
  // safe to run unconditionally — a no-op if a future migration adds CASCADE.
  const { error: gcrErr } = await admin
    .from('goal_change_requests').delete().eq('requester_id', user.id)
  if (gcrErr) {
    console.error('[deleteAccount] goal_change_requests cleanup failed:', gcrErr)
    return { error: `Couldn't delete account: ${gcrErr.message}` }
  }

  // CASCADE on every other FK referencing profiles/auth.users handles the rest
  // (challenges, goals, check-ins, push subscriptions, reactions). Deleting the
  // auth user removes auth.users -> profiles (CASCADE) -> everything else.
  const { error: authErr } = await admin.auth.admin.deleteUser(user.id)
  if (authErr) {
    console.error('[deleteAccount] auth delete failed:', authErr)
    return { error: `Couldn't delete account: ${authErr.message}` }
  }

  // Sign out the client-side session and redirect to landing.
  await supabase.auth.signOut()
  redirect('/')
}
