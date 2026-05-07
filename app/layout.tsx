import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import { createClient } from '@/lib/supabase/server'
import { getAvatarUrl } from '@/lib/avatar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Accountabilibuddies',
  description: 'Track goals with your accountability buddy',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  manifest: '/manifest.json',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let avatarUrl: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_style')
      .eq('id', user.id)
      .single()
    avatarUrl = getAvatarUrl(user.id, profile?.avatar_style ?? 'avataaars')
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        {user && <Navbar avatarUrl={avatarUrl} />}
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  )
}
