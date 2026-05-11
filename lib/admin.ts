import { createClient } from '@/lib/supabase/server'

export async function requireAdmin() {
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  if (adminEmails.length === 0) return null  // no admins configured = no access

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null

  return adminEmails.includes(user.email.toLowerCase()) ? user : null
}
