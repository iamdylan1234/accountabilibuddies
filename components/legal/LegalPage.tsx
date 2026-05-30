import { ReactNode } from 'react'
import Link from 'next/link'
import { BRAND_GRADIENT } from '@/lib/brand'

interface Props {
  title: string
  effectiveDate: string  // "Month YYYY"
  children: ReactNode
}

/**
 * Shared layout for /privacy and /terms. Renders a gradient header strip,
 * a prominent amber draft-banner (these are PLACEHOLDER pages — real legal
 * copy is required before paid launch), the content, and a back link to
 * settings.
 */
export default function LegalPage({ title, effectiveDate, children }: Props) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="rounded-2xl px-5 py-4 mb-4 text-white" style={{ background: BRAND_GRADIENT }}>
        <h1 className="text-2xl font-black">{title}</h1>
        <p className="text-white/80 text-xs font-semibold mt-1">Effective {effectiveDate}</p>
      </div>

      <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 mb-6 text-sm text-amber-900">
        ⚠️ <span className="font-bold">Draft — not legally reviewed.</span>{' '}
        This text is placeholder boilerplate. It must be replaced with text reviewed by a lawyer before any paid launch or App Store submission.
      </div>

      <article className="prose prose-sm max-w-none text-gray-700">
        {children}
      </article>

      <div className="mt-8 pt-4 border-t border-gray-100 text-center">
        <Link href="/settings" className="text-sm font-semibold text-gray-400 hover:text-gray-600 transition">
          ← Back to settings
        </Link>
      </div>
    </div>
  )
}
