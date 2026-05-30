'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Profile } from '@/types/database'
import SettingsSection from './SettingsSection'
import SettingsRow from './SettingsRow'
import NameEditSheet from './NameEditSheet'
import DeleteAccountSheet from './DeleteAccountSheet'
import BuzzToggle from '@/components/profile/BuzzToggle'
import { triggerPasswordReset } from '@/app/settings/actions'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

interface Props {
  email: string
  profile: Profile
  buddy: Profile | null
  appVersion: string
}

export default function SettingsClient({ email, profile, buddy, appVersion }: Props) {
  const router = useRouter()
  const supabase = createSupabaseClient()
  const [nameSheet, setNameSheet] = useState(false)
  const [displayedName, setDisplayedName] = useState(profile.name)
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [deleteSheet, setDeleteSheet] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  async function handlePasswordChange() {
    setPasswordStatus('sending')
    setPasswordError(null)
    const result = await triggerPasswordReset()
    if ('error' in result) {
      setPasswordStatus('error')
      setPasswordError(result.error)
      return
    }
    setPasswordStatus('sent')
    // Auto-clear the "Sent" state after 4 seconds so the user can tap again if needed.
    setTimeout(() => setPasswordStatus('idle'), 4000)
  }

  return (
    <div className="max-w-md mx-auto px-4 py-4">
      {/* Top bar with back link */}
      <div className="relative flex items-center justify-center mb-6 mt-2">
        <Link
          href="/profile"
          className="absolute left-0 text-sm font-semibold text-gray-400 hover:text-gray-600 transition"
        >
          ← Profile
        </Link>
        <h1 className="text-lg font-black text-gray-900">Settings</h1>
      </div>

      <SettingsSection label="Account">
        <SettingsRow
          label="Name"
          variant="nav"
          value={displayedName}
          onClick={() => setNameSheet(true)}
        />
        <SettingsRow label="Email" variant="value" value={email} />
        <SettingsRow
          label="Password"
          variant="nav"
          value={
            passwordStatus === 'sending' ? 'Sending…' :
            passwordStatus === 'sent'    ? 'Check your email ✓' :
            passwordStatus === 'error'   ? 'Try again' :
            'Change'
          }
          onClick={handlePasswordChange}
          disabled={passwordStatus === 'sending'}
        />
        <SettingsRow
          label="Delete account"
          variant="destructive"
          onClick={() => setDeleteSheet(true)}
        />
      </SettingsSection>
      {passwordError && (
        <p className="text-xs text-red-500 px-4 -mt-4 mb-6">{passwordError}</p>
      )}

      <SettingsSection
        label="Notifications"
        hint="Get a buzz only when your buddy sends you a daily message — never automated."
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <span className="flex-1 text-sm font-semibold text-gray-800">Buddy buzz</span>
          <BuzzToggle buddy={buddy} />
        </div>
      </SettingsSection>

      <SettingsSection label="About">
        <Link href="/privacy" prefetch={false} className="block">
          <SettingsRow label="Privacy Policy" variant="nav" />
        </Link>
        <Link href="/terms" prefetch={false} className="block">
          <SettingsRow label="Terms of Service" variant="nav" />
        </Link>
        <a href="mailto:help@accountabilibuddies.app" className="block">
          <SettingsRow label="Support" variant="nav" value="help@accountabilibuddies.app" />
        </a>
        <SettingsRow label="Version" variant="value" value={appVersion} />
        <SettingsRow label="Sign out" variant="action" onClick={handleSignOut} />
      </SettingsSection>
      {nameSheet && (
        <NameEditSheet
          currentName={displayedName}
          onClose={() => setNameSheet(false)}
          onSaved={newName => setDisplayedName(newName)}
        />
      )}
      {deleteSheet && <DeleteAccountSheet onClose={() => setDeleteSheet(false)} />}
    </div>
  )
}
