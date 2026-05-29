'use server'

import { createClient } from '@/lib/supabase/server'
import { isValidTimeZone } from '@/lib/challengeTime'

/**
 * Persists the caller's browser timezone. Called by <TimezoneSync /> only when the
 * browser tz differs from the stored value, so this is a no-op write at worst.
 */
export async function updateTimezone(tz: string): Promise<void> {
  if (!isValidTimeZone(tz)) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('profiles').update({ timezone: tz }).eq('id', user.id)
}
