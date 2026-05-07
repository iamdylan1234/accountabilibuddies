# Buddy Message Speech Bubble — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each user post a short daily message on the Today tab so their buddy can read it without leaving the app.

**Architecture:** Four independent changes — (1) `Profile` type update, (2) `updateDailyMessage` server action, (3) `BuddyMessageRow` + `MessageEditSheet` components, (4) wiring everything into `DashboardClient` and adding a `profiles` realtime subscription.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, Supabase

**Prerequisite (manual):** Before deploying, run this migration in Supabase:
```sql
ALTER TABLE profiles ADD COLUMN daily_message text DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN message_date date DEFAULT NULL;
```

---

## File Map

| Action | Path |
|--------|------|
| Modify | `types/database.ts` |
| Modify | `app/dashboard/checkin-actions.ts` |
| Create | `components/dashboard/BuddyMessageRow.tsx` |
| Create | `components/dashboard/MessageEditSheet.tsx` |
| Modify | `components/dashboard/useDashboardRealtime.ts` |
| Modify | `components/dashboard/DashboardClient.tsx` |

---

## Task 1: Update `Profile` type + `updateDailyMessage` server action

**Files:**
- Modify: `types/database.ts`
- Modify: `app/dashboard/checkin-actions.ts`

- [ ] **Step 1: Add `daily_message` and `message_date` to `Profile`**

In `types/database.ts`, find the `Profile` interface and add the two new fields after `created_at`:

```ts
export interface Profile {
  id: string
  name: string
  avatar_url: string | null
  avatar_style: string
  notification_time: string
  created_at: string
  daily_message: string | null
  message_date: string | null
}
```

- [ ] **Step 2: Add `updateDailyMessage` server action**

Append to `app/dashboard/checkin-actions.ts`:

```ts
export async function updateDailyMessage(message: string): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Use UTC date — acceptable for a daily message (no strict timezone requirement)
  const today = new Date().toISOString().split('T')[0]
  const trimmed = message.trim().slice(0, 150)

  const { error } = await supabase
    .from('profiles')
    .update({
      daily_message: trimmed || null,
      message_date: trimmed ? today : null,
    })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd C:/Users/Admin/accountabilibuddies && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Admin/accountabilibuddies && git add types/database.ts app/dashboard/checkin-actions.ts && git commit -m "feat: Profile type adds daily_message/message_date, updateDailyMessage action"
```

---

## Task 2: `MessageEditSheet` component

**Files:**
- Create: `components/dashboard/MessageEditSheet.tsx`

- [ ] **Step 1: Create the file**

Create `components/dashboard/MessageEditSheet.tsx` with this content:

```tsx
'use client'

import { useState, useEffect, useTransition } from 'react'
import { updateDailyMessage } from '@/app/dashboard/checkin-actions'

interface Props {
  currentMessage: string   // empty string if no message today
  onClose: () => void
}

export default function MessageEditSheet({ currentMessage, onClose }: Props) {
  const [text, setText] = useState(currentMessage)
  const [mounted, setMounted] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  function handleClose() {
    setMounted(false)
    setTimeout(onClose, 280)
  }

  function handleSave() {
    startTransition(async () => {
      await updateDailyMessage(text)
      handleClose()
    })
  }

  function handleClear() {
    startTransition(async () => {
      await updateDailyMessage('')
      handleClose()
    })
  }

  const remaining = 150 - text.length

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${mounted ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="px-5 pt-3 pb-8">
          <p className="font-black text-gray-900 text-base mb-3">Today&apos;s message</p>

          <textarea
            value={text}
            onChange={e => setText(e.target.value.slice(0, 150))}
            placeholder="What's on your mind today?"
            maxLength={150}
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
            autoFocus
          />

          <p className={`text-xs mt-1 text-right ${remaining <= 20 ? 'text-red-400' : 'text-gray-400'}`}>
            {remaining} / 150
          </p>

          <div className="flex gap-3 mt-4">
            {text.trim().length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                disabled={isPending}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-red-500 border border-red-200 disabled:opacity-50"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(90deg,#0d9488,#3b82f6)' }}
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd C:/Users/Admin/accountabilibuddies && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Admin/accountabilibuddies && git add components/dashboard/MessageEditSheet.tsx && git commit -m "feat: MessageEditSheet bottom sheet for daily message editing"
```

---

## Task 3: `BuddyMessageRow` component

**Files:**
- Create: `components/dashboard/BuddyMessageRow.tsx`

- [ ] **Step 1: Create the file**

Create `components/dashboard/BuddyMessageRow.tsx` with this content:

```tsx
import type { Profile } from '@/types/database'

interface Props {
  myProfile: Profile
  buddyProfile: Profile | null
  today: string
  onEditOpen: () => void
}

export default function BuddyMessageRow({ myProfile, buddyProfile, today, onEditOpen }: Props) {
  if (!buddyProfile) return null

  const myMessage = myProfile.message_date === today ? myProfile.daily_message : null
  const buddyMessage = buddyProfile.message_date === today ? buddyProfile.daily_message : null

  return (
    <div className="flex gap-3">
      {/* My column — tappable */}
      <button
        type="button"
        onClick={onEditOpen}
        className="flex-1 rounded-xl px-3 py-2.5 text-left min-h-[44px] flex items-center transition active:scale-95 hover:opacity-90 border border-teal-200 bg-teal-50"
      >
        {myMessage
          ? <span className="text-sm text-gray-800 leading-snug">{myMessage}</span>
          : <span className="text-sm text-teal-400 italic">Add a message…</span>
        }
      </button>

      {/* Buddy column — read-only */}
      <div className="flex-1 rounded-xl px-3 py-2.5 min-h-[44px] flex items-center border border-gray-200 bg-gray-50">
        {buddyMessage
          ? <span className="text-sm text-gray-700 leading-snug">{buddyMessage}</span>
          : null
        }
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd C:/Users/Admin/accountabilibuddies && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Admin/accountabilibuddies && git add components/dashboard/BuddyMessageRow.tsx && git commit -m "feat: BuddyMessageRow two-column daily message display"
```

---

## Task 4: Wire into `DashboardClient` + realtime subscription

**Files:**
- Modify: `components/dashboard/useDashboardRealtime.ts`
- Modify: `components/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Add `profiles` subscription to `useDashboardRealtime`**

In `components/dashboard/useDashboardRealtime.ts`, add a `.on(...)` listener for the `profiles` table to the existing channel chain. Replace the current channel construction with:

```ts
const channel = supabase
  .channel('dashboard-realtime')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'check_ins',
    filter: userFilter,
  }, () => startRefreshTransition(() => router.refresh()))
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'reactions',
    filter: reactionFilter,
  }, () => startRefreshTransition(() => router.refresh()))
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'profiles',
    filter: buddyId ? `id=eq.${buddyId}` : undefined,
  }, () => startRefreshTransition(() => router.refresh()))
  .subscribe()
```

- [ ] **Step 2: Update imports in `DashboardClient.tsx`**

At the top of `components/dashboard/DashboardClient.tsx`, add the two new imports after the existing import lines:

```tsx
import BuddyMessageRow from './BuddyMessageRow'
import MessageEditSheet from './MessageEditSheet'
```

- [ ] **Step 3: Add `messageSheetOpen` state in `DashboardClient`**

After the existing `const [sheet, setSheet] = useState<SheetTarget | null>(null)` line, add:

```tsx
const [messageSheetOpen, setMessageSheetOpen] = useState(false)
```

- [ ] **Step 4: Render `BuddyMessageRow` after `ScoreTileGrid`**

In `DashboardClient.tsx`, find this line:
```tsx
      <div className="space-y-6">
```

Replace it with:
```tsx
      {buddy && myProfile && (
        <BuddyMessageRow
          myProfile={myProfile}
          buddyProfile={buddy}
          today={today}
          onEditOpen={() => setMessageSheetOpen(true)}
        />
      )}

      <div className="space-y-6">
```

- [ ] **Step 5: Render `MessageEditSheet` at the bottom of the return**

Find the existing `GoalCalendarSheet` block at the bottom of the return (just before the final `</div>`). After that block, add:

```tsx
{messageSheetOpen && (
  <MessageEditSheet
    currentMessage={myProfile?.message_date === today ? (myProfile?.daily_message ?? '') : ''}
    onClose={() => setMessageSheetOpen(false)}
  />
)}
```

- [ ] **Step 6: TypeScript check**

```bash
cd C:/Users/Admin/accountabilibuddies && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Run all tests**

```bash
cd C:/Users/Admin/accountabilibuddies && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all pass (no test changes needed for this task).

- [ ] **Step 8: Commit and push**

```bash
cd C:/Users/Admin/accountabilibuddies && git add components/dashboard/useDashboardRealtime.ts components/dashboard/DashboardClient.tsx && git commit -m "feat: buddy message row wired into dashboard with realtime subscription" && git push origin main
```

---

## Manual Verification

After deploying (and after running the Supabase migration):
1. Open dashboard → message row appears between score tiles and Today's Goals
2. My column shows "Add a message…" in italic teal
3. Tap my column → MessageEditSheet slides up
4. Type a message, Save → sheet closes, my column shows the text
5. Open as buddy → buddy column shows my message
6. Buddy types their own message → my dashboard updates in real-time without reload
7. Clear button removes the message — buddy column goes empty
8. Next day → both columns are empty again (stale)
