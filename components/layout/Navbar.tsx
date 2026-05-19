'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BRAND_GRADIENT } from '@/lib/brand'

interface Props {
  avatarUrl: string | null
}

export default function Navbar({ avatarUrl }: Props) {
  const pathname = usePathname()

  const navItems = [
    { href: '/dashboard', label: 'Today' },
    { href: '/week', label: 'This Week' },
    { href: '/wrap-up', label: 'Summary' },
  ]

  return (
    <div className="w-full sticky top-0 z-50">
      {/* Brand bar */}
      <div
        className="w-full px-4 py-3 flex items-center justify-between"
        style={{ background: BRAND_GRADIENT }}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5 -my-1">
          <span className="w-8 h-8 rounded-lg overflow-hidden bg-white shadow-sm flex-shrink-0">
            <img src="/icon.png" alt="" className="w-full h-full object-contain" />
          </span>
          <span className="text-white font-black text-lg tracking-tight">
            Accountabilibuddies
          </span>
        </Link>

        {/* Avatar circle → /profile */}
        <Link
          href="/profile"
          className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/40 hover:border-white/80 transition flex-shrink-0"
          aria-label="Your profile"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              width={32}
              height={32}
              className="w-full h-full object-cover"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <div className="w-full h-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-xs font-bold">?</span>
            </div>
          )}
        </Link>
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
              className={`flex-1 text-center py-2.5 text-sm font-bold transition active:scale-95 border-b-2 ${
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
