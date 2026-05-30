'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Profile } from '@/types/database'
import SettingsSection from './SettingsSection'
import SettingsRow from './SettingsRow'
import NameEditSheet from './NameEditSheet'

interface Props {
  email: string
  profile: Profile
  buddy: Profile | null
  appVersion: string
}

export default function SettingsClient({ email, profile, buddy, appVersion }: Props) {
  const router = useRouter()
  void buddy  // suppress unused warning until Task 6 wires the toggle
  const [nameSheet, setNameSheet] = useState(false)
  const [displayedName, setDisplayedName] = useState(profile.name)

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
        <SettingsRow label="Password" variant="nav" value="Change" />
        <SettingsRow label="Delete account" variant="destructive" />
      </SettingsSection>

      <SettingsSection label="Notifications">
        <SettingsRow
          label="Buddy buzz"
          variant="toggle"
          rightSlot={<span className="text-xs text-gray-400">(coming)</span>}
        />
      </SettingsSection>

      <SettingsSection label="About">
        <SettingsRow label="Privacy Policy" variant="nav" />
        <SettingsRow label="Terms of Service" variant="nav" />
        <SettingsRow label="Support" variant="value" value="help@accountabilibuddies.app" />
        <SettingsRow label="Version" variant="value" value={appVersion} />
        <SettingsRow label="Sign out" variant="action" onClick={() => router.push('/')} />
      </SettingsSection>
      {nameSheet && (
        <NameEditSheet
          currentName={displayedName}
          onClose={() => setNameSheet(false)}
          onSaved={newName => setDisplayedName(newName)}
        />
      )}
    </div>
  )
}
