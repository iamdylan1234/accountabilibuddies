'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const VALID_STYLES = new Set([
  'adventurer', 'adventurer-neutral', 'avataaars', 'avataaars-neutral',
  'big-ears', 'big-ears-neutral', 'big-smile', 'bottts', 'bottts-neutral',
  'croodles', 'croodles-neutral', 'dylan', 'fun-emoji', 'glass', 'icons',
  'identicon', 'initials', 'lorelei', 'lorelei-neutral', 'micah', 'miniavs',
  'notionists', 'notionists-neutral', 'open-peeps', 'personas', 'pixel-art',
  'pixel-art-neutral', 'rings', 'shapes', 'thumbs',
])

export async function updateAvatarStyle(style: string): Promise<{ error: string | null }> {
  if (!VALID_STYLES.has(style)) {
    return { error: 'Invalid avatar style' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_style: style })
    .eq('id', user.id)

  if (error) return { error: error.message }

  // Revalidate both profile page and root layout (for navbar avatar)
  revalidatePath('/profile')
  revalidatePath('/', 'layout')

  return { error: null }
}
