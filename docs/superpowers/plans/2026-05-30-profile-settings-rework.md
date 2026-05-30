# Profile & Settings Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Profile tab into a clean two-surface model — lean Profile (identity + achievements) and a new dedicated Settings screen with grouped Account / Notifications / About sections — bringing the experience to commercial-grade polish (App Store / paid-user expectations).

**Architecture:** Gear-icon nav pattern: ⚙ in Profile top-right opens `/settings`. Settings uses iOS-style grouped rows in three labeled sections, with bottom sheets for in-place editing (name, delete). New `/privacy` and `/terms` static pages support legal requirements. No schema changes — relies on existing `ON DELETE CASCADE` FKs (verified in Task 0).

**Tech Stack:** Next.js 16 App Router (server components + server actions), React 19 (useState/useTransition for sheets), Supabase (auth admin for account deletion), Tailwind, Resend (transactional via existing infrastructure).

Spec: `docs/superpowers/specs/2026-05-30-profile-settings-rework-design.md`

---

## File Structure

| File | Action | Touches |
|---|---|---|
| `app/settings/page.tsx` | create | Server: fetch profile + active challenge |
| `app/settings/actions.ts` | create | `updateName`, `triggerPasswordReset`, `deleteAccount` |
| `components/settings/SettingsClient.tsx` | create | Client wrapper; sheet state; sign-out |
| `components/settings/SettingsSection.tsx` | create | Uppercase label + grouped white card |
| `components/settings/SettingsRow.tsx` | create | Variants: nav, value, action, toggle |
| `components/settings/NameEditSheet.tsx` | create | Name edit bottom sheet |
| `components/settings/DeleteAccountSheet.tsx` | create | Type-DELETE confirmation sheet |
| `components/legal/LegalPage.tsx` | create | Shared layout: gradient header + banner + content + back link |
| `app/privacy/page.tsx` | create | Static legal page (placeholder boilerplate) |
| `app/terms/page.tsx` | create | Static legal page (placeholder boilerplate) |
| `components/profile/ProfileClient.tsx` | modify | Remove BuzzToggle + Sign-out; add gear icon; replace active-line with tappable card |

**Task dependencies:** Task 0 → Task 5. Task 1 is independent. Task 2 → Tasks 3–7. Task 7 → Task 8. All → Task 9.

**Testing reality:** This repo unit-tests pure helpers in `lib/__tests__/` only — server actions, server components, and React components are verified by `tsc + lint + manual smoke`. Don't invent a test harness for the new components or server actions. Match the codebase.

---

### Task 0: Verify CASCADE constraints (pre-flight)

**Why first:** Account deletion (Task 5) relies on `ON DELETE CASCADE` on every FK that references `profiles.id` or `auth.users.id`. If any FK lacks cascade, the delete server action will fail (or worse, leave orphaned rows). This is a 10-minute check that prevents Task 5 from being a debugging session.

**Files:** none (verification only)

- [ ] **Step 1: Query Supabase for the FK constraints**

In Supabase SQL editor (or via `psql` if connected), run:

```sql
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS references_table,
  ccu.column_name AS references_column,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name IN ('profiles', 'users')
ORDER BY tc.table_name, kcu.column_name;
```

Expected to see CASCADE in `delete_rule` for every row, across at minimum: `goals.user_id`, `check_ins.user_id`, `push_subscriptions.user_id`, `reactions.from_user_id`, `challenge_months.creator_id`, `challenge_months.buddy_id`, plus any `goal_change_requests` references.

- [ ] **Step 2: If any FK is NOT CASCADE, record what's missing**

For each non-cascade FK, write down: `(table.column → references → action)`. These will need either:
1. A migration to add `ON DELETE CASCADE` (preferred), or
2. Explicit cleanup in the `deleteAccount` server action ordering, BEFORE the auth user delete.

If all are CASCADE: nothing to do, proceed.

- [ ] **Step 3: Document the result**

Save the query result and any missing-cascade notes to `docs/superpowers/specs/2026-05-30-cascade-audit.md` for the record. If migrations are needed, those become a Task 0.5 before Task 5.

- [ ] **Step 4: Commit the audit doc**

```bash
git add docs/superpowers/specs/2026-05-30-cascade-audit.md
git commit -m "docs(profile-rework): cascade audit pre-flight for account deletion"
```

---

### Task 1: Slim down Profile + add gear icon + active-challenge card

**Files:**
- Modify: `components/profile/ProfileClient.tsx`

- [ ] **Step 1: Remove BuzzToggle import + render**

Remove the import line:
```ts
import BuzzToggle from './BuzzToggle'
```

Remove the BuzzToggle render block (currently after Challenge History):
```tsx
<BuzzToggle buddy={activeChallenge ? (activeChallenge.creator_id === userId ? activeChallenge.buddy : activeChallenge.creator) : null} />
```

- [ ] **Step 2: Remove Sign out + handler**

Remove the sign-out button block:
```tsx
<div className="mt-12 flex justify-center">
  <button onClick={handleSignOut} ...>Sign out</button>
</div>
```

And remove the `handleSignOut` function and the `useRouter` + `createClient()` imports/state if no longer used by anything else in ProfileClient. (Note: `useRouter` may still be used elsewhere — verify before removing.)

- [ ] **Step 3: Add the gear icon at top-right of the page**

Imports to add:
```ts
import Link from 'next/link'
```
(If not already imported.)

At the very top of the returned JSX, wrap the existing avatar block in a relative container and add a gear icon as an absolute-positioned link:

```tsx
return (
  <div className="max-w-4xl mx-auto px-4 py-6">
    {/* Header with gear */}
    <div className="relative">
      <Link
        href="/settings"
        aria-label="Settings"
        className="absolute top-0 right-0 p-2 -m-2 text-gray-400 hover:text-gray-600 transition active:scale-95"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </Link>

      {/* Avatar + name (existing block) */}
      <div className="flex flex-col items-center gap-2 mb-8">
        {/* ... existing avatar button + name + active line ... */}
      </div>
    </div>

    {/* ... rest of the page ... */}
```

- [ ] **Step 4: Replace active-challenge text line with a tappable card**

In the existing avatar block, the line:
```tsx
<p className="text-sm text-gray-400 font-semibold">{activeLine}</p>
```

needs to be replaced with conditional rendering. Above the JSX, replace the existing `activeLine` derivation with:

```ts
const activeCardData = activeChallenge
  ? (() => {
      const start = new Date(activeChallenge.start_date)
      const today = new Date()
      const dayNumber = Math.max(
        1,
        Math.floor((today.getTime() - start.getTime()) / 86400000) + 1
      )
      const totalDays = Math.floor(
        (new Date(activeChallenge.end_date).getTime() - start.getTime()) / 86400000
      ) + 1
      return { name: activeChallenge.month_name, dayNumber, totalDays }
    })()
  : null
```

Then in the JSX, replace the `<p>{activeLine}</p>` with:

```tsx
{activeCardData ? (
  <Link
    href="/dashboard"
    className="block w-full mt-3 rounded-xl px-4 py-3 text-white shadow-sm active:scale-95 transition"
    style={{ background: BRAND_GRADIENT }}
  >
    <div className="flex items-center justify-between gap-3">
      <div className="text-left flex-1 min-w-0">
        <p className="font-black text-base truncate">{activeCardData.name}</p>
        <p className="text-xs text-white/75 font-semibold mt-0.5">
          Day {activeCardData.dayNumber} of {activeCardData.totalDays}
        </p>
      </div>
      <span className="text-white/80 text-lg font-bold flex-shrink-0">→</span>
    </div>
  </Link>
) : (
  <p className="text-sm text-gray-400 font-semibold">No active challenge</p>
)}
```

Add the `BRAND_GRADIENT` import if not already present:
```ts
import { BRAND_GRADIENT } from '@/lib/brand'
```

- [ ] **Step 5: Type-check**

Run: `cd /c/Users/Admin/accountabilibuddies && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/profile/ProfileClient.tsx
git commit -m "feat(profile-rework): slim Profile + gear icon + active-challenge card"
```

---

### Task 2: Settings route scaffold + section/row components

**Files:**
- Create: `app/settings/page.tsx`
- Create: `components/settings/SettingsClient.tsx`
- Create: `components/settings/SettingsSection.tsx`
- Create: `components/settings/SettingsRow.tsx`

- [ ] **Step 1: Create `SettingsSection.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `SettingsRow.tsx`**

```tsx
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
  /** Tap handler; used for 'action', 'destructive', and optionally 'nav' when not a Link. */
  onClick?: () => void
  /** Disabled / loading state for action rows. */
  disabled?: boolean
}

/**
 * Single tappable row inside a SettingsSection. Variants:
 *   - nav         label + value? + right chevron, calls onClick (parent renders a Link wrapper if a route)
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

  if (!isTappable) return content
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="w-full text-left">
      {content}
    </button>
  )
}
```

- [ ] **Step 3: Create `app/settings/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from '@/components/settings/SettingsClient'
import type { ChallengeWithProfiles, Profile } from '@/types/database'

// Force dynamic rendering — same reasoning as /dashboard and /week.
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/auth/login')

  // Buddy lookup for the BuzzToggle (existing component needs a buddy prop).
  const { data: activeChallenge } = await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const typedActive = activeChallenge as unknown as ChallengeWithProfiles | null
  const buddy = typedActive
    ? ((typedActive.creator_id === user.id ? typedActive.buddy : typedActive.creator) as Profile | null)
    : null

  return (
    <SettingsClient
      email={user.email ?? ''}
      profile={profile}
      buddy={buddy}
      appVersion={process.env.npm_package_version ?? '0.0.0'}
    />
  )
}
```

- [ ] **Step 4: Create scaffold `SettingsClient.tsx` (placeholder rows; later tasks fill them in)**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Profile } from '@/types/database'
import SettingsSection from './SettingsSection'
import SettingsRow from './SettingsRow'

interface Props {
  email: string
  profile: Profile
  buddy: Profile | null
  appVersion: string
}

export default function SettingsClient({ email, profile, buddy, appVersion }: Props) {
  const router = useRouter()
  void buddy  // suppress unused warning until Task 6 wires the toggle

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
        <SettingsRow label="Name" variant="nav" value={profile.name} />
        <SettingsRow label="Email" variant="value" value={email} />
        <SettingsRow label="Password" variant="nav" value="Change" />
        <SettingsRow label="Delete account" variant="destructive" />
      </SettingsSection>

      <SettingsSection label="Notifications">
        <SettingsRow label="Buddy buzz" variant="toggle" rightSlot={<span className="text-xs text-gray-400">(coming)</span>} />
      </SettingsSection>

      <SettingsSection label="About">
        <SettingsRow label="Privacy Policy" variant="nav" />
        <SettingsRow label="Terms of Service" variant="nav" />
        <SettingsRow label="Support" variant="value" value="help@accountabilibuddies.app" />
        <SettingsRow label="Version" variant="value" value={appVersion} />
        <SettingsRow label="Sign out" variant="action" onClick={() => router.push('/')} />
      </SettingsSection>
    </div>
  )
}
```

(Later tasks wire up real handlers + sheets + Link wrappers around nav rows.)

- [ ] **Step 5: Type-check + build**

```
cd /c/Users/Admin/accountabilibuddies && npx tsc --noEmit && npm run build 2>&1 | tail -5
```

Expected: tsc clean, build succeeds, `/settings` appears in the route list.

- [ ] **Step 6: Commit**

```bash
git add app/settings components/settings
git commit -m "feat(profile-rework): /settings scaffold with grouped section + row primitives"
```

---

### Task 3: Account section — Name row + NameEditSheet + updateName action

**Files:**
- Create: `app/settings/actions.ts` (initial — adds `updateName`)
- Create: `components/settings/NameEditSheet.tsx`
- Modify: `components/settings/SettingsClient.tsx`

- [ ] **Step 1: Add `updateName` server action**

Create `app/settings/actions.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateName(name: string): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in. Please log in again.' }

  const trimmed = name.trim()
  if (trimmed.length === 0) return { error: 'Name cannot be empty.' }
  if (trimmed.length > 50) return { error: 'Name is too long (max 50 characters).' }

  const { error } = await supabase
    .from('profiles')
    .update({ name: trimmed })
    .eq('id', user.id)

  if (error) {
    console.error('[updateName] update failed:', error)
    return { error: `Couldn't save: ${error.message}` }
  }

  revalidatePath('/profile')
  revalidatePath('/settings')
}
```

- [ ] **Step 2: Create `NameEditSheet.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { updateName } from '@/app/settings/actions'

interface Props {
  currentName: string
  onClose: () => void
  onSaved: (newName: string) => void
}

export default function NameEditSheet({ currentName, onClose, onSaved }: Props) {
  const [name, setName] = useState(currentName)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateName(name)
      if (result?.error) {
        setError(result.error)
        return
      }
      onSaved(name.trim())
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-black text-gray-900 mb-1">Edit name</h2>
        <p className="text-sm text-gray-500 mb-4">This is the name your buddy sees.</p>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={50}
          autoFocus
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          placeholder="Your name"
        />
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="flex-1 py-3 rounded-xl font-bold text-sm text-gray-600 bg-gray-100 active:scale-95 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending || name.trim().length === 0 || name.trim() === currentName}
            className="flex-1 py-3 rounded-xl font-bold text-sm text-white bg-teal-500 disabled:opacity-50 active:scale-95 transition"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire NameEditSheet into SettingsClient**

In `components/settings/SettingsClient.tsx`:

Add imports:
```ts
import { useState } from 'react'
import NameEditSheet from './NameEditSheet'
```

Add state inside the component (just above the return):
```ts
const [nameSheet, setNameSheet] = useState(false)
const [displayedName, setDisplayedName] = useState(profile.name)
```

Update the Name row to use the state + open the sheet:
```tsx
<SettingsRow
  label="Name"
  variant="nav"
  value={displayedName}
  onClick={() => setNameSheet(true)}
/>
```

(NB: Make `SettingsRow.tsx`'s `nav` variant honour `onClick` when no Link wraps it — the current implementation already does, since the variant uses a button.)

Render the sheet at the bottom of the return:
```tsx
{nameSheet && (
  <NameEditSheet
    currentName={displayedName}
    onClose={() => setNameSheet(false)}
    onSaved={newName => setDisplayedName(newName)}
  />
)}
```

- [ ] **Step 4: Type-check + build**

```
cd /c/Users/Admin/accountabilibuddies && npx tsc --noEmit && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add app/settings/actions.ts components/settings/NameEditSheet.tsx components/settings/SettingsClient.tsx
git commit -m "feat(profile-rework): Account → Name row + edit sheet + updateName action"
```

---

### Task 4: Account section — Email row + Password change (reset email)

**Files:**
- Modify: `app/settings/actions.ts` (add `triggerPasswordReset`)
- Modify: `components/settings/SettingsClient.tsx`

- [ ] **Step 1: Add `triggerPasswordReset` action**

Append to `app/settings/actions.ts`:

```ts
export async function triggerPasswordReset(): Promise<{ error: string } | { sent: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Not signed in.' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://accountabilibuddies.app'
  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${appUrl}/auth/reset-password`,
  })

  if (error) {
    console.error('[triggerPasswordReset] failed:', error)
    return { error: `Couldn't send reset email: ${error.message}` }
  }

  return { sent: true }
}
```

- [ ] **Step 2: Wire the Email + Password rows in `SettingsClient.tsx`**

The Email row is already correct (`variant="value" value={email}`) — nothing to change.

For Password, add a small toast/status state and a handler:

```ts
import { triggerPasswordReset } from '@/app/settings/actions'

// ... inside the component:
const [passwordStatus, setPasswordStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
const [passwordError, setPasswordError] = useState<string | null>(null)

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
  // Auto-clear the "Sent" state after 4 seconds.
  setTimeout(() => setPasswordStatus('idle'), 4000)
}
```

Update the Password row:
```tsx
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
```

(Optional: render `passwordError` inline beneath the Account section as a small red note.)

- [ ] **Step 3: Type-check**

`cd /c/Users/Admin/accountabilibuddies && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add app/settings/actions.ts components/settings/SettingsClient.tsx
git commit -m "feat(profile-rework): Account → Email read-only + Password change (reset email)"
```

---

### Task 5: Account section — Delete account row + sheet + action

**Depends on Task 0 verification of CASCADE constraints.**

**Files:**
- Modify: `app/settings/actions.ts` (add `deleteAccount`)
- Create: `components/settings/DeleteAccountSheet.tsx`
- Modify: `components/settings/SettingsClient.tsx`

- [ ] **Step 1: Add `deleteAccount` server action**

Append to `app/settings/actions.ts`:

```ts
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export async function deleteAccount(confirmation: string): Promise<{ error: string } | never> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  // Server-side belt: client already requires typing DELETE.
  if (confirmation !== 'DELETE') {
    return { error: 'Confirmation text does not match. Type DELETE exactly.' }
  }

  // CASCADE on FKs handles related rows (verified in Task 0). Delete the auth
  // user via the admin client; the auth.users row deletes the profiles row
  // (auth.users.id → profiles.id), which cascades to challenges, goals, etc.
  const admin = createAdminClient()
  const { error: authErr } = await admin.auth.admin.deleteUser(user.id)
  if (authErr) {
    console.error('[deleteAccount] auth delete failed:', authErr)
    return { error: `Couldn't delete account: ${authErr.message}` }
  }

  // Sign out the client-side session and redirect to landing.
  await supabase.auth.signOut()
  redirect('/')
}
```

- [ ] **Step 2: Create `DeleteAccountSheet.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { deleteAccount } from '@/app/settings/actions'

interface Props {
  onClose: () => void
}

export default function DeleteAccountSheet({ onClose }: Props) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const ready = text === 'DELETE'

  function handleDestroy() {
    setError(null)
    startTransition(async () => {
      const result = await deleteAccount(text)
      // deleteAccount redirects on success, so we only land here on error.
      if (result && 'error' in result) setError(result.error)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 pb-8" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-black text-red-500 mb-2">Delete account</h2>
        <p className="text-sm text-gray-700 mb-3">
          This permanently removes:
        </p>
        <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1 mb-4">
          <li>Your account and profile</li>
          <li>All your challenges (and your buddy's view of them)</li>
          <li>All your goals and check-ins</li>
          <li>Notification subscriptions</li>
        </ul>
        <p className="text-sm text-gray-700 mb-3">
          This cannot be undone. To confirm, type <span className="font-bold text-gray-900">DELETE</span> below:
        </p>
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          autoFocus
          autoComplete="off"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
          placeholder="Type DELETE"
        />
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="flex-1 py-3 rounded-xl font-bold text-sm text-gray-600 bg-gray-100 active:scale-95 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDestroy}
            disabled={!ready || pending}
            className="flex-1 py-3 rounded-xl font-bold text-sm text-white bg-red-500 disabled:opacity-50 active:scale-95 transition"
          >
            {pending ? 'Deleting…' : 'Delete forever'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire into `SettingsClient.tsx`**

Add import + state:
```ts
import DeleteAccountSheet from './DeleteAccountSheet'
// ... in component:
const [deleteSheet, setDeleteSheet] = useState(false)
```

Update the Delete row:
```tsx
<SettingsRow
  label="Delete account"
  variant="destructive"
  onClick={() => setDeleteSheet(true)}
/>
```

Render the sheet at the bottom (next to the name sheet):
```tsx
{deleteSheet && <DeleteAccountSheet onClose={() => setDeleteSheet(false)} />}
```

- [ ] **Step 4: Type-check**

`cd /c/Users/Admin/accountabilibuddies && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add app/settings/actions.ts components/settings/DeleteAccountSheet.tsx components/settings/SettingsClient.tsx
git commit -m "feat(profile-rework): Account → Delete account (type-DELETE confirm + admin delete)"
```

---

### Task 6: Notifications section — Buddy buzz row

**Files:**
- Modify: `components/settings/SettingsClient.tsx`

The existing `components/profile/BuzzToggle.tsx` already handles subscribe/unsubscribe. We reuse it as the `rightSlot` of a SettingsRow.

- [ ] **Step 1: Wire BuzzToggle into the Notifications row**

In `SettingsClient.tsx`, replace the placeholder Notifications section:

```tsx
import BuzzToggle from '@/components/profile/BuzzToggle'

// ...

<SettingsSection
  label="Notifications"
  hint="Get a buzz only when your buddy sends you a daily message — never automated."
>
  <div className="px-4 py-3 flex items-center gap-3">
    <span className="flex-1 text-sm font-semibold text-gray-800">Buddy buzz</span>
    <BuzzToggle buddy={buddy} />
  </div>
</SettingsSection>
```

(Use a direct inline layout rather than `SettingsRow` because BuzzToggle is its own composite component — wrapping it inside a button would break its toggle gesture. The visual still matches a settings row.)

Remove the placeholder Notifications row that just said "(coming)".

- [ ] **Step 2: Verify BuzzToggle still works in this new context**

The BuzzToggle component expects a `buddy` prop. We're passing it from the server. If BuzzToggle has any UX coupled to being in a "buzz banner" or specific styling — adapt minimally; otherwise no changes needed.

- [ ] **Step 3: Type-check**

`cd /c/Users/Admin/accountabilibuddies && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add components/settings/SettingsClient.tsx
git commit -m "feat(profile-rework): Notifications → Buddy buzz toggle (reuses BuzzToggle)"
```

---

### Task 7: About section — Privacy / Terms / Support / Version / Sign out

**Files:**
- Modify: `components/settings/SettingsClient.tsx`

- [ ] **Step 1: Make Privacy + Terms rows real Links**

Currently `SettingsRow` is a button. For the Privacy/Terms rows, we want them to navigate via `next/link`. Easiest: wrap the SettingsRow in a Link with `prefetch={false}` (legal pages are rarely visited).

```tsx
<Link href="/privacy" prefetch={false} className="block">
  <SettingsRow label="Privacy Policy" variant="nav" />
</Link>
<Link href="/terms" prefetch={false} className="block">
  <SettingsRow label="Terms of Service" variant="nav" />
</Link>
```

(Heads-up: the `SettingsRow` currently renders a `<button>` for nav-variant rows. Wrapping a button in a Link creates nested-interactive HTML which React will warn about. Fix: for `nav`-variant rows when an `onClick` is NOT provided, render a plain `<div>` instead of a button — the parent Link supplies the click behaviour. Update `SettingsRow.tsx` accordingly:)

```tsx
// In SettingsRow.tsx — adjust the return for nav/action/destructive:
if (variant === 'nav' && !onClick) {
  return content   // parent (e.g. <Link>) handles the click
}
if (!isTappable) return content
return (
  <button type="button" onClick={onClick} disabled={disabled} className="w-full text-left">
    {content}
  </button>
)
```

- [ ] **Step 2: Support row as a mailto link**

```tsx
<a href="mailto:help@accountabilibuddies.app" className="block">
  <SettingsRow label="Support" variant="nav" value="help@accountabilibuddies.app" />
</a>
```

- [ ] **Step 3: Version row (unchanged, already in scaffold)**

```tsx
<SettingsRow label="Version" variant="value" value={appVersion} />
```

- [ ] **Step 4: Sign-out row — real handler**

Replace the placeholder `onClick={() => router.push('/')}` with a real sign-out:

```ts
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

// ... in component:
const supabase = createSupabaseClient()

async function handleSignOut() {
  await supabase.auth.signOut()
  router.push('/')
  router.refresh()
}
```

```tsx
<SettingsRow label="Sign out" variant="action" onClick={handleSignOut} />
```

- [ ] **Step 5: Type-check + build**

```
cd /c/Users/Admin/accountabilibuddies && npx tsc --noEmit && npm run build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add components/settings/SettingsClient.tsx components/settings/SettingsRow.tsx
git commit -m "feat(profile-rework): About → Privacy/Terms/Support/Version/Sign out"
```

---

### Task 8: Privacy + Terms pages + shared LegalPage layout

**Files:**
- Create: `components/legal/LegalPage.tsx`
- Create: `app/privacy/page.tsx`
- Create: `app/terms/page.tsx`

- [ ] **Step 1: Create `LegalPage.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `app/privacy/page.tsx`**

```tsx
import LegalPage from '@/components/legal/LegalPage'

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate="May 2026">
      <h2 className="text-lg font-bold text-gray-900 mt-4 mb-2">Introduction</h2>
      <p>
        Accountabilibuddies (&quot;we&quot;, &quot;us&quot;) operates the Accountabilibuddies
        application. This policy explains what data we collect, why, and how we use it.
      </p>

      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">Information we collect</h2>
      <p>
        When you sign up we collect your name, email address, and a password (stored hashed
        by our authentication provider, Supabase). While using the app we store the goals,
        check-ins, daily messages, and reactions you create, plus your buddy pairings.
      </p>

      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">How we use your information</h2>
      <p>
        We use your data to provide the service: showing your dashboard, sharing check-ins
        with your buddy, sending notification pushes, and computing your stats. We do not
        sell your data and do not share it with third parties except service providers
        strictly necessary to operate the app (Supabase for storage, Resend for email,
        Vercel for hosting, Google FCM for push delivery on Android).
      </p>

      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">Your rights</h2>
      <p>
        You can edit your name, change your password, and permanently delete your account
        from the Settings screen. Deleting your account removes your profile, all your
        challenges, goals, check-ins, and notification subscriptions.
      </p>

      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">Contact</h2>
      <p>
        Questions about this policy or your data? Email{' '}
        <a className="text-teal-600" href="mailto:help@accountabilibuddies.app">help@accountabilibuddies.app</a>.
      </p>
    </LegalPage>
  )
}
```

- [ ] **Step 3: Create `app/terms/page.tsx`**

```tsx
import LegalPage from '@/components/legal/LegalPage'

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" effectiveDate="May 2026">
      <h2 className="text-lg font-bold text-gray-900 mt-4 mb-2">Acceptance</h2>
      <p>
        By using Accountabilibuddies you agree to these terms. If you do not agree,
        do not use the service.
      </p>

      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">Use of the service</h2>
      <p>
        Accountabilibuddies is a habit-accountability app where you pair with one buddy,
        set monthly goals, and check in daily. You are responsible for keeping your
        account credentials secure and for the content of the goals and messages you
        create. Do not use the service to harass, threaten, or deceive your buddy.
      </p>

      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">Account termination</h2>
      <p>
        You may delete your account at any time from the Settings screen. We may suspend
        or terminate accounts that violate these terms.
      </p>

      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">Disclaimer of warranties</h2>
      <p>
        The service is provided &quot;as is&quot; without warranty of any kind. We do
        not guarantee that the service will be uninterrupted, error-free, or that any
        habit will improve as a result of using it.
      </p>

      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">Changes to these terms</h2>
      <p>
        We may update these terms from time to time. The effective date above will be
        updated when we do. Continued use after a change constitutes acceptance.
      </p>

      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">Contact</h2>
      <p>
        Questions about these terms? Email{' '}
        <a className="text-teal-600" href="mailto:help@accountabilibuddies.app">help@accountabilibuddies.app</a>.
      </p>
    </LegalPage>
  )
}
```

- [ ] **Step 4: Type-check + build**

```
cd /c/Users/Admin/accountabilibuddies && npx tsc --noEmit && npm run build 2>&1 | tail -10
```

Expected: `/privacy` and `/terms` appear in the route list.

- [ ] **Step 5: Commit**

```bash
git add app/privacy app/terms components/legal
git commit -m "feat(profile-rework): Privacy + Terms placeholder pages with amber draft banner"
```

---

### Task 9: Full verification + manual smoke

**Files:** none (verification only)

- [ ] **Step 1: Full automated checks**

```
cd /c/Users/Admin/accountabilibuddies
npm test                  # existing tests should pass (no new tests added)
npx tsc --noEmit          # no errors
npm run build             # all routes compile, /settings /privacy /terms appear
```

- [ ] **Step 2: Lint scoped to the new + modified files**

```
cd /c/Users/Admin/accountabilibuddies && npx eslint \
  components/profile/ProfileClient.tsx \
  app/settings/page.tsx \
  app/settings/actions.ts \
  components/settings \
  components/legal \
  app/privacy/page.tsx \
  app/terms/page.tsx
```

Expected: zero errors from these files. Any error must be fixed before merge.

- [ ] **Step 3: Manual smoke (dev server or Vercel preview)**

1. Profile tab: gear icon visible top-right; tapping it loads `/settings`.
2. Profile tab: active-challenge card shows with correct day count and links to `/dashboard`.
3. Settings — Account:
   - Tap Name → sheet opens with current name, edit, Save → reflects on Profile.
   - Email row shows your real email.
   - Tap Password → "Sending…" → "Check your email ✓" → real email arrives, link works.
   - Tap Delete account → sheet opens; "Delete forever" disabled until DELETE typed; **DO NOT test destroy here unless using a throwaway account**.
4. Settings — Notifications: Buddy buzz toggle reflects current state; toggling adds/removes a `push_subscriptions` row (verify with `scripts/who-is-who.mjs`).
5. Settings — About: Privacy and Terms open the pages with the amber draft banner; Support row launches mail client; Version row shows the package version; Sign out lands on `/`.
6. Legal pages: amber draft banner is visible at the top; back link returns to `/settings`.

- [ ] **Step 4: (Optional) Destructive smoke with a throwaway**

Sign up a test account (e.g., `delete-test@example.com`) → create no challenges or a single throwaway → Settings → Delete account → confirm DELETE. Verify:
- Redirected to `/`.
- Sign-in fails (account gone).
- `scripts/who-is-who.mjs` no longer lists the user.
- Any challenges the user was part of are also removed (CASCADE working).

- [ ] **Step 5: No additional commit unless smoke surfaces fixes**

If steps 3–4 require code changes, commit them with a descriptive message. Otherwise, nothing to commit.

---

## Self-Review

- **Spec coverage:**
  - Surface 1 (lean Profile + gear icon + active-challenge card) → Task 1
  - Surface 2 (Settings screen + Account/Notifications/About sections) → Tasks 2–7
  - Surface 3 (Privacy + Terms pages) → Task 8
  - Schema verification (CASCADE pre-flight) → Task 0
  - All five baked-in decisions (legal banner, type-DELETE, support email, gear pattern, sheet-not-route depth) → covered in the relevant tasks (8, 5, 7, 1, 3/5)
  - Out-of-scope items (email change, subscription, real legal text) → explicitly left for Phase 2

- **Type consistency:** Server actions use consistent `{ error: string } | undefined` (or `| { sent: true }` for password). `SettingsRow` `nav`-variant works both with `onClick` (button) and with parent `<Link>` (div, no inner button). `SettingsSection` uses a stable `label + hint?` shape across all four uses.

- **No placeholders:** every step has complete code or an exact instruction with examples.

- **Reasonable task size:** largest task is Task 5 (delete account); smallest is Task 9 (verification). Each is independently testable and reversible.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-30-profile-settings-rework.md`. Two execution options:

1. **Subagent-Driven (recommended for this scope)** — dispatch fresh subagent per task with two-stage review between each. Catches subtle UI/server-action issues across the 10-file rework.

2. **Inline Execution** — execute tasks in this session via `executing-plans`, batch with checkpoints. Faster but less independent review.

**Which approach?**
