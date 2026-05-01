'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const navItems = [
    { href: '/dashboard', label: 'Today' },
    { href: '/month', label: 'Month' },
    { href: '/wrap-up', label: 'Summary' },
  ]

  return (
    <div className="w-full sticky top-0 z-50">
      {/* Brand bar */}
      <div
        className="w-full px-4 py-3 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #00C9A7 0%, #0077B6 100%)' }}
      >
        <span className="text-white font-black text-lg tracking-tight">
          Accountabilibuddies
        </span>
        <button
          onClick={signOut}
          className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/20 text-white hover:bg-white/30 transition"
        >
          Sign out
        </button>
      </div>

      {/* Nav tab bar */}
      <div className="w-full bg-white border-b border-gray-100 flex">
        {navItems.map(({ href, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              prefetch={true}
              className={`flex-1 text-center py-2.5 text-sm font-bold transition border-b-2 ${
                active
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
