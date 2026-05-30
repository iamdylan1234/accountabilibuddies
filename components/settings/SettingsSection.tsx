'use client'

import { ReactNode } from 'react'

interface Props {
  label: string
  children: ReactNode
  /** Footer text shown beneath the grouped card (e.g. "Used to identify you to your buddy"). Optional. */
  hint?: string
}

/**
 * iOS-style settings section: uppercase label, grouped white rows with subtle
 * dividers between them. The rows are rendered as children — each child should
 * be a SettingsRow.
 */
export default function SettingsSection({ label, children, hint }: Props) {
  return (
    <section className="mb-6">
      <p className="text-xs font-black text-gray-400 uppercase tracking-wide px-4 mb-2">{label}</p>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
        {children}
      </div>
      {hint && <p className="text-xs text-gray-400 px-4 mt-2">{hint}</p>}
    </section>
  )
}
