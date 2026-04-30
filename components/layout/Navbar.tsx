'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Navbar() {
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="w-full px-6 py-4 flex items-center justify-between"
      style={{ background: 'linear-gradient(135deg, #00C9A7 0%, #0077B6 100%)' }}>
      <Link href="/dashboard" className="text-white font-black text-xl tracking-tight">
        Accountabilibuddies
      </Link>
      <div className="flex gap-4 items-center">
        <Link href="/month" className="text-white/80 hover:text-white text-sm font-semibold">
          Month
        </Link>
        <Link href="/wrap-up" className="text-white/80 hover:text-white text-sm font-semibold">
          Summary
        </Link>
        <button
          onClick={signOut}
          className="text-sm font-semibold px-4 py-1.5 rounded-full bg-white/20 text-white hover:bg-white/30 transition"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
