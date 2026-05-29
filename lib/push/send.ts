import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'
import { firstNameOf } from '@/lib/profile'

// Configure VAPID once at module load. setVapidDetails is idempotent.
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:dylan@africancleanenergy.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

/**
 * Sends a push to every subscription belonging to `recipientId`. Expired
 * subscriptions (404/410) are deleted. Never throws — logs other errors and
 * swallows them so callers' primary flow can't break on a push failure.
 */
export async function pushToUser(recipientId: string, title: string, body: string): Promise<void> {
  const supabase = createAdminClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', recipientId)
  if (!subs || subs.length === 0) return
  const payload = JSON.stringify({ title, body })
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload,
      )
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        console.error('[pushToUser] push send failed', { subId: sub.id, statusCode: err?.statusCode })
      }
    }
  }))
}

/**
 * Fire one buzz from `senderId` to `recipientId`. Looks up the sender's name
 * for the notification body, queries the recipient's push subscriptions, and
 * sends to all of them in parallel. Subscriptions that return 404 or 410 are
 * expired or revoked — deleted on the spot. Other errors are logged and
 * swallowed; this function never throws (callers don't want their save flow
 * to break because a push service had a 5xx).
 */
export async function sendBuzz(senderId: string, recipientId: string): Promise<void> {
  const supabase = createAdminClient()
  const { data: sender } = await supabase.from('profiles').select('name').eq('id', senderId).single()
  const firstName = firstNameOf(sender)
  await pushToUser(recipientId, 'Accountabilibuddies', `${firstName} sent you a buzz 🤜🤛`)
}

/** Push the recipient when a buddy proposes a rematch. */
export async function sendRematchProposalPush(proposerId: string, recipientId: string): Promise<void> {
  const supabase = createAdminClient()
  const { data: proposer } = await supabase.from('profiles').select('name').eq('id', proposerId).single()
  const firstName = firstNameOf(proposer)
  await pushToUser(recipientId, 'Accountabilibuddies', `${firstName} wants to run it back 🤜🤛`)
}
