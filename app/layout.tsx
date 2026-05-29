import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import NextTopLoader from 'nextjs-toploader'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import InstallBanner from '@/components/layout/InstallBanner'
import TimezoneSync from '@/components/TimezoneSync'
import { createClient } from '@/lib/supabase/server'
import { getAvatarUrl } from '@/lib/avatar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Accountabilibuddies — 2 mates. No excuses.',
  description: 'Pair up with one buddy. Set monthly goals. Check in daily. Real accountability between two people.',
  manifest: '/manifest.json',
  // Next.js auto-detects app/icon.png and app/apple-icon.png — no explicit icons block needed.
  themeColor: '#00C9A7',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Buddies',
  },
  openGraph: {
    title: 'Accountabilibuddies',
    description: '2 mates. No excuses.',
    url: 'https://accountabilibuddies.vercel.app',
    siteName: 'Accountabilibuddies',
    type: 'website',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let avatarUrl: string | null = null
  let timezone: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_style, timezone')
      .eq('id', user.id)
      .single()
    avatarUrl = getAvatarUrl(user.id, profile?.avatar_style ?? 'avataaars')
    timezone = profile?.timezone ?? null
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Progress bar for any navigation event. Positioned (via CSS in
            globals.css) at the bottom edge of the sticky navbar — the bar
            visually anchors to the tab bar so the user sees navigation
            feedback right where they took the action. No shadow because
            the bar sits on white (against the gray tab-bar border), so
            the brand teal is clearly visible without a halo. */}
        <NextTopLoader
          color="#00C9A7"
          height={3}
          showSpinner={false}
        />
        {user && <Navbar avatarUrl={avatarUrl} />}
        <main className="min-h-screen">{children}</main>
        {user && <InstallBanner />}
        {user && <TimezoneSync currentTz={timezone} />}
      </body>
    </html>
  )
}
