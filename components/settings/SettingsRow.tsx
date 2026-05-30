'use client'

import { ReactNode } from 'react'

type RowVariant = 'nav' | 'value' | 'action' | 'toggle' | 'destructive'

interface BaseProps {
  label: string
  /** Variant determines right-side affordance + click behaviour. */
  variant: RowVariant
  /** Right-side value text (for 'value' or compact info next to chevron). */
  value?: string
  /** Right-side custom content (e.g. a toggle component). Wins over `value`. */
  rightSlot?: ReactNode
  /** Tap handler; used for 'action', 'destructive', and 'nav' when not wrapped in a Link. */
  onClick?: () => void
  /** Disabled / loading state for action rows. */
  disabled?: boolean
}

/**
 * Single tappable row inside a SettingsSection. Variants:
 *   - nav         label + value? + right chevron — clickable via onClick, or wrap in a parent <Link>
 *   - value       label + value, no chevron, no tap
 *   - action      label only, no chevron, calls onClick (e.g. Sign out, Send reset email)
 *   - toggle      label + rightSlot (a Toggle component), no tap on the row
 *   - destructive same as action but with red label colour
 */
export default function SettingsRow({ label, variant, value, rightSlot, onClick, disabled }: BaseProps) {
  const isTappable = variant === 'nav' || variant === 'action' || variant === 'destructive'
  const labelColor = variant === 'destructive' ? 'text-red-500' : 'text-gray-800'
  const showChevron = variant === 'nav'

  const content = (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${isTappable ? 'active:bg-gray-50 transition' : ''}`}>
      <span className={`flex-1 text-sm font-semibold ${labelColor} ${disabled ? 'opacity-50' : ''}`}>{label}</span>
      {rightSlot ?? (value && (
        <span className="text-sm text-gray-400 font-medium">{value}</span>
      ))}
      {showChevron && (
        <span className="text-gray-300 text-lg" aria-hidden="true">›</span>
      )}
    </div>
  )

  // nav without an onClick: parent wraps in a <Link>, return content as a plain div
  if (variant === 'nav' && !onClick) return content

  if (!isTappable) return content

  return (
    <button type="button" onClick={onClick} disabled={disabled} className="w-full text-left">
      {content}
    </button>
  )
}
