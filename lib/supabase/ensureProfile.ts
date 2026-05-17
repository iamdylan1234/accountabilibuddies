import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * Idempotently ensures a `profiles` row exists for the authenticated user.
 *
 * Why this exists: auth.users and profiles are separate tables. The auth row
 * is created automatically by Supabase Auth, but the profiles row is created
 * by application code (signup page upsert). If a profiles row is ever
 * deleted out-of-band — manual cleanup, accidental admin action, GDPR
 * delete-and-recreate, etc. — the user can still log in but every server
 * action that INSERTs into a table with a FK to profiles.id will fail
 * silently (e.g. challenge_months.creator_id → profiles.id).
 *
 * Call this in any server action before the first DB write to guarantee the
 * profile exists. Safe to call on every action — it's a single upsert that
 * no-ops when the row already exists.
 *
 * Returns the user object unchanged for ergonomic chaining at the top of
 * server actions: `const user = await ensureProfile(supabase, await getUser(...))`.
 */
export async function ensureProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<User> {
  const name = (user.user_metadata?.name as string | undefined)?.trim()
    || (user.email?.split('@')[0])
    || 'User'

  // upsert with onConflict: 'id' is a no-op when the row already exists.
  // ignoreDuplicates avoids overwriting an existing name.
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, name }, { onConflict: 'id', ignoreDuplicates: true })

  if (error) {
    // Log but don't throw — the caller's INSERT will surface the FK violation
    // anyway, and we don't want this guard to be the source of a crash.
    console.error('[ensureProfile] upsert failed:', error)
  }

  return user
}
