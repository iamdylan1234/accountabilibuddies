import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import NextTopLoader from 'nextjs-toploader'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
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
        {/* Top-of-page progress bar — fires on ANY navigation (tab clicks,
            avatar→profile, deep links, back button). Brand teal so it
            blends with the rest of the visual system. Subtle shadow gives
            a tiny halo so it's visible against light backgrounds. */}
        <NextTopLoader
          color="#00C9A7"
          height={3}
          showSpinner={false}
          shadow="0 0 8px rgba(0, 201, 167, 0.6)"
        />
        {user && <Navbar avatarUrl={avatarUrl} />}
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  )
}
