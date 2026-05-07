import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Subscribes to check_in and reaction changes for the two challenge
 * participants and calls router.refresh() whenever a change arrives.
 *
 * Returns `isRefreshing` — true while the refresh transition is pending,
 * used to dim the score tiles during reload.
 */
export function useDashboardRealtime(myId: string, buddyId: string | undefined) {
  const router = useRouter()
  const supabase = createClient()
  const [isRefreshing, startRefreshTransition] = useTransition()

  useEffect(() => {
    // Scope to only the two participants so we don't trigger a full refresh
    // on every check_in/reaction change across the whole DB.
    const userFilter = buddyId
      ? `user_id=in.(${myId},${buddyId})`
      : `user_id=eq.${myId}`
    const reactionFilter = buddyId
      ? `from_user_id=in.(${myId},${buddyId})`
      : `from_user_id=eq.${myId}`

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'check_ins',
        filter: userFilter,
      }, () => startRefreshTransition(() => router.refresh()))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reactions',
        filter: reactionFilter,
      }, () => startRefreshTransition(() => router.refresh()))
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: buddyId ? `id=eq.${buddyId}` : undefined,
      }, () => startRefreshTransition(() => router.refresh()))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // supabase and router are stable refs; myId and buddyId are fixed for the
  // lifetime of this challenge session — intentionally omitting from deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { isRefreshing }
}
