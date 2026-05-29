# Buddy Rematch (Part B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let two buddies continue into a new challenge with one tap ("Run it back") + an in-app accept — no invite link, idempotent, with the new challenge's dates governed by the per-user-midnight rules from Part A.

**Architecture:** A rematch creates a *forming* challenge (a `pending` `challenge_months` row, creator = proposer, `proposed_to` = the last buddy, `buddy_id` null, `rematch_of` = the finished challenge) and pushes the buddy. Accept attaches the buddy + locks dates. **Activation is automatic via the existing `on_goal_inserted` DB trigger** (`activate_challenge_if_ready()` flips a pending challenge to active once it has a `buddy_id` and both users have ≥5 goals) — so this plan adds no activation code; it only has to produce a correctly-shaped forming challenge. `UNIQUE(rematch_of)` makes propose idempotent. Decline/withdraw/expiry/other-challenge delete the forming row.

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres + the `activate_challenge_if_ready` trigger), TypeScript, web-push (existing), `lib/challengeTime.ts` + `lib/dateUtils.ts` (existing), Jest.

**Spec:** `docs/superpowers/specs/2026-05-29-rematch-and-timezone-design.md` (Part B). Part A (timezone) is already merged.

**Critical existing behaviour to preserve:**
- DB trigger `activate_challenge_if_ready()` activates `pending` → `active` when `buddy_id IS NOT NULL` and creator + buddy each have ≥5 goals. The rematch relies on this untouched.
- `saveGoals` (`app/setup/actions.ts`) saves goals for a challenge the caller is creator OR buddy of, and refuses if `status === 'active'`. The forming challenge is `pending`, so both can set goals through the normal `/setup` flow.

---

## File Map

**Create:**
- `lib/rematch.ts` — pure helper: `rematchDates(acceptLocalToday)` → `{ start_date, end_date, month_name }`.
- `lib/__tests__/rematch.test.ts` — tests.
- `app/dashboard/rematch-actions.ts` — `'use server'`: `proposeRematch`, `acceptRematch`, `declineRematch`, `withdrawRematch`.
- `components/dashboard/RematchButton.tsx` — client; "Run it back" CTA (posts `proposeRematch`).
- `components/dashboard/RematchProposalCard.tsx` — client; recipient's Accept/Decline card.
- `docs/migrations/2026-05-29-rematch.sql` — migration record.

**Modify:**
- `types/database.ts` — add `rematch_of`, `proposed_to` to `ChallengeMonth`.
- `lib/push/send.ts` — extract a shared `pushToUser` and add `sendRematchProposalPush`.
- `app/dashboard/page.tsx` — pass rematch eligibility to `CompletionCard`; render the proposer "waiting" state and the recipient proposal card.
- `components/dashboard/CompletionCard.tsx` — render the `RematchButton` when eligible.
- `app/dashboard/actions.ts` (`createChallenge`) and `app/invite/[token]/actions.ts` (`acceptInvite`) — auto-void any pending rematch the user is part of.
- `app/api/cron/monthly/route.ts` — 14-day expiry sweep of forming rematch challenges.
- `app/setup/page.tsx` + `components/goals/GoalSetupForm.tsx` — "Copy my goals from last challenge" button.

**Run once manually:** the SQL in Task 1.

---

## Task 1: Schema migration

**Files:** run manually in Supabase; Create `docs/migrations/2026-05-29-rematch.sql`.

- [ ] **Step 1: Run the SQL in Supabase**

```sql
ALTER TABLE challenge_months ADD COLUMN rematch_of  uuid DEFAULT NULL REFERENCES challenge_months(id) ON DELETE SET NULL;
ALTER TABLE challenge_months ADD COLUMN proposed_to uuid DEFAULT NULL REFERENCES profiles(id) ON DELETE CASCADE;

-- At most one rematch per finished challenge (idempotency for double-tap).
CREATE UNIQUE INDEX uniq_challenge_rematch_of ON challenge_months(rematch_of) WHERE rematch_of IS NOT NULL;
```

Expected: two `ALTER` successes + one `CREATE INDEX` success.

- [ ] **Step 2: Verify**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name='challenge_months' AND column_name IN ('rematch_of','proposed_to');
```
Expected: two rows.

- [ ] **Step 3: Record + commit the artefact**

Create `docs/migrations/2026-05-29-rematch.sql` with the exact SQL from Step 1, prefixed:

```sql
-- 2026-05-29 — Buddy rematch (Part B). Applied to production via Supabase SQL Editor.
```

```bash
git add docs/migrations/2026-05-29-rematch.sql
git commit -m "chore(db): record rematch columns migration"
```

---

## Task 2: Type updates

**Files:** Modify `types/database.ts`.

- [ ] **Step 1: Add fields to `ChallengeMonth`**

The current interface:
```ts
export interface ChallengeMonth {
  id: string
  creator_id: string
  buddy_id: string | null
  invite_token: string
  month_name: string
  start_date: string
  end_date: string
  status: ChallengeStatus
  created_at: string
}
```
Add two fields before the closing brace:
```ts
  rematch_of: string | null    // the completed challenge this one continues, if any
  proposed_to: string | null   // intended buddy on a forming rematch, before they accept
```

- [ ] **Step 2: Type-check + commit**

`npx tsc --noEmit` → zero errors.
```bash
git add types/database.ts
git commit -m "feat(types): add rematch_of + proposed_to to ChallengeMonth"
```

---

## Task 3: `rematchDates` helper

**Files:** Create `lib/rematch.ts`, `lib/__tests__/rematch.test.ts`.

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/rematch.test.ts`:
```ts
import { rematchDates } from '../rematch'

describe('rematchDates', () => {
  it('starts the day after acceptance and runs 30 days inclusive', () => {
    const r = rematchDates('2026-06-03')
    expect(r.start_date).toBe('2026-06-04')
    expect(r.end_date).toBe('2026-07-03')   // start + 29
  })
  it('names the challenge after the start month', () => {
    expect(rematchDates('2026-06-03').month_name).toBe('June Challenge')
  })
  it('handles a start that crosses into the next month', () => {
    const r = rematchDates('2026-06-30')      // start 2026-07-01
    expect(r.start_date).toBe('2026-07-01')
    expect(r.end_date).toBe('2026-07-30')
    expect(r.month_name).toBe('July Challenge')
  })
  it('handles year boundary', () => {
    const r = rematchDates('2026-12-31')      // start 2027-01-01
    expect(r.start_date).toBe('2027-01-01')
    expect(r.month_name).toBe('January Challenge')
  })
})
```

- [ ] **Step 2: Run → FAIL**

`npx jest lib/__tests__/rematch.test.ts` → `Cannot find module '../rematch'`.

- [ ] **Step 3: Implement**

Create `lib/rematch.ts`:
```ts
import { addDays } from '@/lib/dateUtils'

/**
 * Date fields for a rematch challenge accepted on `acceptLocalToday` (the
 * accepter's local "YYYY-MM-DD"). Starts the next day, runs 30 days inclusive
 * (start + 29, matching createChallenge), and is named after the start month.
 */
export function rematchDates(acceptLocalToday: string): {
  start_date: string
  end_date: string
  month_name: string
} {
  const start_date = addDays(acceptLocalToday, 1)
  const end_date = addDays(start_date, 29)
  const [y, m] = start_date.split('-').map(Number)
  const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long' })
  return { start_date, end_date, month_name: `${monthName} Challenge` }
}
```

- [ ] **Step 4: Run → PASS**

`npx jest lib/__tests__/rematch.test.ts` → 4 pass.

- [ ] **Step 5: Commit**
```bash
git add lib/rematch.ts lib/__tests__/rematch.test.ts
git commit -m "feat(rematch): rematchDates helper (start+1, +29, month-named)"
```

---

## Task 4: Push — extract `pushToUser`, add `sendRematchProposalPush`

**Files:** Modify `lib/push/send.ts`. Test: `lib/push/__tests__/send.test.ts` (existing).

- [ ] **Step 1: Read `lib/push/send.ts`**

It currently exports `sendBuzz(senderId, recipientId)` which: looks up the sender's first name, fetches the recipient's `push_subscriptions`, builds `payload = { title: 'Accountabilibuddies', body: \`${firstName} sent you a buzz 🤜🤛\` }`, sends to each sub, and deletes subs on 404/410.

- [ ] **Step 2: Refactor — extract the send loop into `pushToUser`**

Add this exported function and rewrite `sendBuzz` to use it. The extracted function takes an explicit title/body so other notification types can reuse it:

```ts
/**
 * Sends a push to every subscription belonging to `recipientId`. Expired
 * subscriptions (404/410) are deleted. Never throws — logs other errors and
 * swallows them so callers' primary flow can't break on a push failure.
 */
export async function pushToUser(recipientId: string, title: string, body: string): Promise<void> {
  const supabase = createAdminClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', recipientId)
  if (!subs || subs.length === 0) return
  const payload = JSON.stringify({ title, body })
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload,
      )
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        console.error('[pushToUser] push send failed', { subId: sub.id, statusCode: err?.statusCode })
      }
    }
  }))
}
```

Rewrite `sendBuzz` to delegate (keeping its existing first-name lookup + copy):
```ts
export async function sendBuzz(senderId: string, recipientId: string): Promise<void> {
  const supabase = createAdminClient()
  const { data: sender } = await supabase.from('profiles').select('name').eq('id', senderId).single()
  const firstName = firstNameOf(sender)
  await pushToUser(recipientId, 'Accountabilibuddies', `${firstName} sent you a buzz 🤜🤛`)
}
```

Add `sendRematchProposalPush`:
```ts
/** Push the recipient when a buddy proposes a rematch. */
export async function sendRematchProposalPush(proposerId: string, recipientId: string): Promise<void> {
  const supabase = createAdminClient()
  const { data: proposer } = await supabase.from('profiles').select('name').eq('id', proposerId).single()
  const firstName = firstNameOf(proposer)
  await pushToUser(recipientId, 'Accountabilibuddies', `${firstName} wants to run it back 🤜🤛`)
}
```

Keep the existing `webpush.setVapidDetails(...)` module init and `import { firstNameOf } from '@/lib/profile'` / `createAdminClient` imports.

- [ ] **Step 3: Verify the existing sendBuzz tests still pass**

`npx jest lib/push/__tests__/send.test.ts` → all existing tests still pass (sendBuzz behaviour is unchanged: still sends one push per sub with the buzz body, still cleans up 404/410). If the test mocks reference internals that moved, the public behaviour is identical — only adjust the test if it asserted on a private structure; do not change the asserted behaviour.

- [ ] **Step 4: tsc + commit**

`npx tsc --noEmit` → zero errors.
```bash
git add lib/push/send.ts
git commit -m "refactor(push): extract pushToUser; add sendRematchProposalPush"
```

---

## Task 5: `proposeRematch` action

**Files:** Create `app/dashboard/rematch-actions.ts`.

- [ ] **Step 1: Implement `proposeRematch`**

Create `app/dashboard/rematch-actions.ts`:
```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { sendRematchProposalPush } from '@/lib/push/send'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

/**
 * Propose a rematch of a finished challenge. Creates a forming challenge
 * (pending, creator = me, proposed_to = my last buddy, buddy_id null,
 * rematch_of = finished). Idempotent via UNIQUE(rematch_of): if a proposal for
 * that finished challenge already exists, route to it instead of duplicating
 * (the "both tapped Run it back" case → the second tapper accepts the first).
 */
export async function proposeRematch(finishedChallengeId: string): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  // Load the finished challenge; caller must be a participant and it must be completed.
  const { data: finished } = await supabase
    .from('challenge_months')
    .select('id, creator_id, buddy_id, status')
    .eq('id', finishedChallengeId)
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .maybeSingle()
  if (!finished) return { error: 'Challenge not found.' }
  if (finished.status !== 'completed') return { error: 'You can only rematch a finished challenge.' }

  // Can't propose if you're already in an active/pending challenge.
  const { data: existing } = await supabase
    .from('challenge_months')
    .select('id')
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .in('status', ['active', 'pending'])
    .limit(1)
    .maybeSingle()
  if (existing) return { error: 'Finish or leave your current challenge first.' }

  const buddyId = finished.creator_id === user.id ? finished.buddy_id : finished.creator_id
  if (!buddyId) return { error: 'That challenge had no buddy to rematch.' }

  // If a rematch for this finished challenge already exists, this is the "both
  // tapped" case — accept it instead of inserting a duplicate.
  const { data: already } = await supabase
    .from('challenge_months')
    .select('id, proposed_to')
    .eq('rematch_of', finishedChallengeId)
    .maybeSingle()
  if (already) {
    // If I'm the intended recipient, accept; otherwise just go to my pending one.
    if (already.proposed_to === user.id) return acceptRematch(already.id, todayLocalFallback())
    revalidatePath('/dashboard')
    redirect('/dashboard')
  }

  const { data: created, error } = await supabase
    .from('challenge_months')
    .insert({
      creator_id: user.id,
      buddy_id: null,
      proposed_to: buddyId,
      rematch_of: finishedChallengeId,
      month_name: 'Rematch',          // placeholder; real name set on accept (rematchDates)
      // start/end are placeholders until accept locks them; never used while pending.
      start_date: todayLocalFallback(),
      end_date: todayLocalFallback(),
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    // Unique violation = someone else proposed in the race; converge to theirs.
    if (error.code === '23505') { revalidatePath('/dashboard'); redirect('/dashboard') }
    return { error: `Couldn't propose rematch: ${error.message}` }
  }

  await sendRematchProposalPush(user.id, buddyId)
  revalidatePath('/dashboard')
  redirect(`/setup?challenge=${created.id}`)
}

// Server-side "today" fallback for placeholder dates only (real dates use the
// client-supplied local today on accept). UTC is fine for a never-read placeholder.
function todayLocalFallback(): string {
  return new Date().toISOString().split('T')[0]
}
```

Note: `proposeRematch` references `acceptRematch` (Task 6) — implement Task 6 in the same file before running. If executing strictly task-by-task, add a temporary `acceptRematch` stub that throws, replace it in Task 6, and only run this task's manual check after Task 6.

- [ ] **Step 2: tsc + commit** (functional verification is the smoke test in Task 12)

`npx tsc --noEmit` → zero errors (after Task 6's `acceptRematch` exists).
```bash
git add app/dashboard/rematch-actions.ts
git commit -m "feat(rematch): proposeRematch action (forming challenge, idempotent, push)"
```

---

## Task 6: `acceptRematch`, `declineRematch`, `withdrawRematch`

**Files:** Modify `app/dashboard/rematch-actions.ts`.

- [ ] **Step 1: Add the three actions**

Add the import at the top of `app/dashboard/rematch-actions.ts`:
```ts
import { rematchDates } from '@/lib/rematch'
```

Add:
```ts
/**
 * Accept a rematch proposed to me. Attaches me as buddy, locks the dates
 * (start = my local tomorrow, +29) and the month-flavored name, clears
 * proposed_to. Both buddies then set goals; the existing on_goal_inserted DB
 * trigger flips status → active once both have ≥5 goals. `today` is the
 * accepter's local YYYY-MM-DD (sent from the client).
 */
export async function acceptRematch(challengeId: string, today: string): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return { error: 'Invalid date.' }

  const { data: forming } = await supabase
    .from('challenge_months')
    .select('id, proposed_to, status, buddy_id')
    .eq('id', challengeId)
    .maybeSingle()
  if (!forming || forming.status !== 'pending' || forming.proposed_to !== user.id || forming.buddy_id) {
    return { error: 'This rematch is no longer available.' }
  }

  const { start_date, end_date, month_name } = rematchDates(today)
  const { error } = await supabase
    .from('challenge_months')
    .update({ buddy_id: user.id, proposed_to: null, start_date, end_date, month_name })
    .eq('id', challengeId)
    .eq('proposed_to', user.id)   // optimistic guard against a race
  if (error) return { error: `Couldn't accept: ${error.message}` }

  revalidatePath('/dashboard')
  redirect(`/setup?challenge=${challengeId}`)
}

/** Decline a rematch proposed to me — deletes the forming challenge. */
export async function declineRematch(challengeId: string): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }
  const { error } = await supabase
    .from('challenge_months')
    .delete()
    .eq('id', challengeId)
    .eq('proposed_to', user.id)
    .eq('status', 'pending')
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
}

/** Withdraw a rematch I proposed — deletes the forming challenge. */
export async function withdrawRematch(challengeId: string): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }
  const { error } = await supabase
    .from('challenge_months')
    .delete()
    .eq('id', challengeId)
    .eq('creator_id', user.id)
    .not('proposed_to', 'is', null)   // only a still-forming (un-accepted) rematch
    .eq('status', 'pending')
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  redirect('/dashboard')
}
```

- [ ] **Step 2: tsc + full suite + commit**

`npx tsc --noEmit` → zero errors. `npx jest --silent` → all pass.
```bash
git add app/dashboard/rematch-actions.ts
git commit -m "feat(rematch): accept/decline/withdraw actions"
```

---

## Task 7: Auto-void pending rematch when starting a different challenge

A pending rematch must vanish if either party starts/joins a different challenge (you can only be in one). Enforce it at the two entry points.

**Files:** Modify `app/dashboard/actions.ts` (`createChallenge`), `app/invite/[token]/actions.ts` (`acceptInvite`).

- [ ] **Step 1: In `createChallenge`, before inserting the new challenge**

Read `app/dashboard/actions.ts`. After the auth + `ensureProfile` and BEFORE the "existing pending" idempotency check, delete any forming rematch this user proposed or was proposed to:
```ts
  // Starting a fresh challenge voids any pending rematch you're part of.
  await supabase
    .from('challenge_months')
    .delete()
    .or(`creator_id.eq.${user.id},proposed_to.eq.${user.id}`)
    .not('proposed_to', 'is', null)
    .eq('status', 'pending')
```
Place it right after `await ensureProfile(supabase, user)`.

- [ ] **Step 2: In `acceptInvite`, before setting buddy_id**

Read `app/invite/[token]/actions.ts`. After the `if (challenge.creator_id === user.id)` guard and BEFORE the `update({ buddy_id: user.id })`, add:
```ts
  // Joining a link-invite challenge voids any pending rematch you're part of.
  await supabase
    .from('challenge_months')
    .delete()
    .or(`creator_id.eq.${user.id},proposed_to.eq.${user.id}`)
    .not('proposed_to', 'is', null)
    .eq('status', 'pending')
```

- [ ] **Step 3: tsc + full suite + commit**

`npx tsc --noEmit` → zero. `npx jest --silent` → all pass.
```bash
git add app/dashboard/actions.ts app/invite/[token]/actions.ts
git commit -m "feat(rematch): auto-void pending rematch when starting/joining another challenge"
```

---

## Task 8: 14-day expiry sweep in the daily cron

**Files:** Modify `app/api/cron/monthly/route.ts`.

- [ ] **Step 1: Add the expiry sweep**

Read `app/api/cron/monthly/route.ts`. After the auth guards and the `supabase` client is created, and BEFORE the active-challenge completion logic, add:
```ts
  // Expire stale forming rematch proposals (un-accepted after 14 days).
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  await supabase
    .from('challenge_months')
    .delete()
    .not('proposed_to', 'is', null)   // still forming (buddy hasn't accepted)
    .eq('status', 'pending')
    .lt('created_at', cutoff)
```

This runs every daily invocation; it's cheap and self-healing.

- [ ] **Step 2: tsc + full suite + commit**

`npx tsc --noEmit` → zero. `npx jest --silent` → all pass.
```bash
git add app/api/cron/monthly/route.ts
git commit -m "feat(rematch): sweep 14-day-expired rematch proposals in daily cron"
```

---

## Task 9: "Copy my goals from last challenge" in setup

**Files:** Modify `app/setup/page.tsx`, `components/goals/GoalSetupForm.tsx`.

- [ ] **Step 1: Fetch the user's previous goals in `app/setup/page.tsx`**

Read `app/setup/page.tsx`. It loads the challenge for `?challenge=<id>` and renders `<GoalSetupForm>`. Add a query for the caller's goals from their most recent OTHER challenge (any status), to offer as a copy source:
```ts
  // Most recent prior challenge of this user (excluding the one being set up).
  const { data: priorChallenges } = await supabase
    .from('challenge_months')
    .select('id')
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .neq('id', challengeId)
    .order('created_at', { ascending: false })
    .limit(1)

  let previousGoals: { title: string; type: string; target_count: number | null; target_unit: string | null; schedule_dates: string[] | null; catch_up: boolean }[] = []
  if (priorChallenges && priorChallenges.length > 0) {
    const { data: pg } = await supabase
      .from('goals')
      .select('title, type, target_count, target_unit, schedule_dates, catch_up')
      .eq('challenge_id', priorChallenges[0].id)
      .eq('user_id', user.id)
    previousGoals = pg ?? []
  }
```
Pass `previousGoals={previousGoals}` to `<GoalSetupForm>`. (Use the exact prop-passing pattern already in the file; `user` is already available there.)

- [ ] **Step 2: Add the button + prop in `GoalSetupForm.tsx`**

Read `components/goals/GoalSetupForm.tsx`. It's a client component holding `goals` state (an array of drafts with `title`, `type`, `target_count`, `target_unit`, `schedule_dates`, `catch_up`). Add to its `Props`:
```ts
  previousGoals?: { title: string; type: string; target_count: number | null; target_unit: string | null; schedule_dates: string[] | null; catch_up: boolean }[]
```
When `previousGoals` is non-empty, render a button above the goal list:
```tsx
{previousGoals && previousGoals.length > 0 && (
  <button
    type="button"
    onClick={() => setGoals(previousGoals.map(g => ({
      title: g.title,
      type: g.type as GoalType,
      target_count: g.target_count != null ? String(g.target_count) : '',
      target_unit: g.target_unit ?? '',
      schedule_dates: g.schedule_dates ?? [],
      catch_up: g.catch_up,
    })))}
    className="w-full mb-4 py-2.5 rounded-xl bg-gray-100 text-sm font-bold text-gray-700 active:scale-95 transition"
  >
    Copy my goals from last challenge
  </button>
)}
```
Use the form's actual state-setter name (likely `setGoals`) and the `GoalType` import already present. The mapped shape must match the form's existing draft shape exactly (string `target_count`, etc.).

- [ ] **Step 3: Verify + commit**

`npx tsc --noEmit` → zero. `npx jest --silent` → all pass. Manually confirm the button appears on `/setup` for a user with a prior challenge and pre-fills the form.
```bash
git add app/setup/page.tsx components/goals/GoalSetupForm.tsx
git commit -m "feat(rematch): copy-last-challenge-goals button in setup"
```

---

## Task 10: Completion-card "Run it back" CTA

**Files:** Create `components/dashboard/RematchButton.tsx`. Modify `components/dashboard/CompletionCard.tsx`, `app/dashboard/page.tsx`.

- [ ] **Step 1: Create the button (client)**

Create `components/dashboard/RematchButton.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { proposeRematch } from '@/app/dashboard/rematch-actions'

export default function RematchButton({ finishedChallengeId, buddyName }: { finishedChallengeId: string; buddyName: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function go() {
    setBusy(true); setError(null)
    const res = await proposeRematch(finishedChallengeId)   // redirects to /setup on success
    if (res?.error) { setError(res.error); setBusy(false) }
  }
  return (
    <div className="mt-5">
      <button type="button" onClick={go} disabled={busy}
        className="w-full py-2.5 rounded-xl bg-white text-sm font-black text-teal-700 active:scale-95 transition disabled:opacity-60">
        {busy ? 'Sending…' : `🤜🤛 Run it back with ${buddyName}`}
      </button>
      {error && <p className="text-xs text-white/90 font-semibold mt-2">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Render it from `CompletionCard`**

Read `components/dashboard/CompletionCard.tsx`. Add two optional props and render the button when present:
```ts
interface Props {
  challengeName: string
  myName: string
  buddyName: string
  myScore: number
  buddyScore: number
  result: 'won' | 'lost' | 'tied'
  rematchOf?: string          // finished challenge id; enables the CTA when set
}
```
After the "See full results" link, add:
```tsx
{rematchOf && <RematchButton finishedChallengeId={rematchOf} buddyName={buddyName} />}
```
Add `import RematchButton from './RematchButton'` at the top.

- [ ] **Step 3: Pass `rematchOf` from the dashboard**

Read `app/dashboard/page.tsx`. The `buildCompletionCard(...)` helper returns a `<CompletionCard>`. The CTA should only appear when the user can actually rematch — i.e., the card is for a **completed** challenge and they have no active/pending challenge. The completed-challenge branch (`if (!challenge)`) is exactly that state, so pass `rematchOf={challenge.id}` there. The **ended-on-read** branch is NOT eligible (the challenge isn't `completed` in the DB yet — the cron hasn't run), so do NOT pass `rematchOf` there.

Add a parameter to `buildCompletionCard`:
```ts
function buildCompletionCard(
  challenge: ChallengeWithProfiles, goals: Goal[], myCheckIns: CheckIn[], buddyCheckIns: CheckIn[],
  userId: string, today: string, opts?: { rematchOf?: string },
) {
  // ...existing body...
  return (
    <CompletionCard
      challengeName={challenge.month_name}
      myName={firstNameOf(meProfile)}
      buddyName={firstNameOf(buddyProfile)}
      myScore={myScore}
      buddyScore={buddyScore}
      result={result}
      rematchOf={opts?.rematchOf}
    />
  )
}
```
In the `if (!challenge)` completed branch, call it with `{ rematchOf: completed.id }`. In the ended-on-read branch, call it with no `opts` (omit rematchOf).

- [ ] **Step 4: Verify + commit**

`npx tsc --noEmit` → zero. `npx jest --silent` → all pass (the existing `CompletionCard.test.tsx` still passes since `rematchOf` is optional and absent there).
```bash
git add components/dashboard/RematchButton.tsx components/dashboard/CompletionCard.tsx app/dashboard/page.tsx
git commit -m "feat(rematch): Run-it-back CTA on the completion card"
```

---

## Task 11: Recipient proposal card + proposer waiting state

**Files:** Create `components/dashboard/RematchProposalCard.tsx`. Modify `app/dashboard/page.tsx`.

- [ ] **Step 1: Create the recipient's Accept/Decline card (client)**

Create `components/dashboard/RematchProposalCard.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { acceptRematch, declineRematch } from '@/app/dashboard/rematch-actions'
import { formatDate, addDays } from '@/lib/dateUtils'
import { BRAND_GRADIENT } from '@/lib/brand'

export default function RematchProposalCard({ challengeId, proposerName }: { challengeId: string; proposerName: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = formatDate(new Date())       // accepter's LOCAL today
  const start = addDays(today, 1)

  async function accept() {
    setBusy(true); setError(null)
    const res = await acceptRematch(challengeId, today)    // redirects to /setup on success
    if (res?.error) { setError(res.error); setBusy(false) }
  }
  async function decline() {
    setBusy(true); setError(null)
    const res = await declineRematch(challengeId)
    if (res?.error) { setError(res.error); setBusy(false) }
  }

  return (
    <div className="rounded-2xl p-5 text-white" style={{ background: BRAND_GRADIENT }}>
      <p className="font-black text-base">🤜🤛 {proposerName} wants to run it back</p>
      <p className="text-white/80 text-xs mt-1">A new 30-day challenge starting tomorrow ({start}).</p>
      {error && <p className="text-xs text-white/90 font-semibold mt-2">{error}</p>}
      <div className="flex gap-2 mt-4">
        <button type="button" onClick={decline} disabled={busy}
          className="flex-1 py-2 rounded-xl text-sm font-bold bg-white/20 active:scale-95 transition disabled:opacity-60">
          Not now
        </button>
        <button type="button" onClick={accept} disabled={busy}
          className="flex-1 py-2 rounded-xl text-sm font-black bg-white text-teal-700 active:scale-95 transition disabled:opacity-60">
          {busy ? '…' : 'Accept'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Show the recipient card in the dashboard's no-challenge branch**

Read `app/dashboard/page.tsx`. In the `if (!challenge)` branch (the user has no active/pending of their own), query an incoming rematch proposal and render the card above the completion card:
```ts
    // Incoming rematch proposal (someone proposed to me).
    const { data: incomingRaw } = await supabase
      .from('challenge_months')
      .select('*, creator:profiles!creator_id(*)')
      .eq('proposed_to', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const incoming = incomingRaw as unknown as (ChallengeWithProfiles | null)
    const proposalCard = incoming
      ? <RematchProposalCard challengeId={incoming.id} proposerName={firstNameOf(incoming.creator)} />
      : null
```
Render `{proposalCard}` at the top of the returned `<div className="max-w-md mx-auto mt-12 px-6 space-y-8">`, before `{completionCard}`. Add `import RematchProposalCard from '@/components/dashboard/RematchProposalCard'`.

- [ ] **Step 3: Proposer "waiting" state in the pending branch**

In `app/dashboard/page.tsx`, the `if (typedChallenge.status === 'pending')` branch currently shows the invite link. Branch on `proposed_to`: a forming rematch (proposed_to set, no buddy yet) shows a waiting state instead of the link. Replace the body of that branch with:
```tsx
  if (typedChallenge.status === 'pending') {
    // Rematch the creator proposed, not yet accepted → waiting state (no link).
    if (typedChallenge.proposed_to && !typedChallenge.buddy_id && typedChallenge.creator_id === user.id) {
      const recipientName = firstNameOf(typedChallenge.buddy ?? null)  // buddy not set yet → fallback
      return (
        <div className="max-w-md mx-auto mt-20 px-6">
          <h1 className="text-2xl font-black text-gray-900 mb-2">Waiting on your buddy</h1>
          <p className="text-gray-500 mb-6">Your rematch invite was sent. It expires in 14 days if not accepted.</p>
          <a href={`/setup?challenge=${typedChallenge.id}`} className="block text-center py-2.5 rounded-xl text-sm font-bold text-teal-700 bg-teal-50 mb-3">
            Set your goals
          </a>
          <PendingChallengeActions challengeId={typedChallenge.id} />
        </div>
      )
    }
    // Normal link-invite pending (unchanged).
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${typedChallenge.invite_token}`
    return (
      <div className="max-w-md mx-auto mt-20 px-6">
        <h1 className="text-3xl font-black text-gray-900 mb-2">{typedChallenge.month_name}</h1>
        <p className="text-gray-500 mb-8">Waiting for your buddy to join. Share this link:</p>
        <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
          <span className="text-sm text-gray-700 break-all flex-1">{inviteUrl}</span>
          <CopyButton text={inviteUrl} />
        </div>
        <p className="text-sm text-gray-400 mt-4">Once your buddy joins and sets their goals, the challenge begins.</p>
        <PendingChallengeActions challengeId={typedChallenge.id} />
      </div>
    )
  }
```
(`PendingChallengeActions` here lets the proposer cancel; it deletes the pending challenge — which for a rematch is effectively a withdraw. Confirm `PendingChallengeActions`/`deleteChallenge` works on a creator-owned pending challenge; it does — `deleteChallenge` allows the creator to delete a pending challenge.)

- [ ] **Step 4: Verify + commit**

`npx tsc --noEmit` → zero. `npx jest --silent` → all pass.
```bash
git add components/dashboard/RematchProposalCard.tsx app/dashboard/page.tsx
git commit -m "feat(rematch): recipient proposal card + proposer waiting state"
```

---

## Task 12: Manual smoke test (post-deploy)

**Files:** none.

- [ ] **Step 1:** Run Task 1's SQL in Supabase; deploy the branch; confirm the build succeeds.
- [ ] **Step 2:** As user A, open a **completed** challenge's dashboard → tap "Run it back with B" → you land on `/setup`; set 5 goals. In Supabase, a `challenge_months` row exists with `rematch_of` set, `proposed_to = B`, `buddy_id` null, `status='pending'`.
- [ ] **Step 3:** As user B (2nd browser/device), confirm the **push** arrived ("A wants to run it back") and the dashboard shows the **Accept/Decline** card. Tap Accept → land on `/setup`; the challenge now has `buddy_id = B`, `proposed_to` null, `start_date` = tomorrow, `end_date` = +29, name "<Month> Challenge".
- [ ] **Step 4:** B sets 5 goals → in Supabase the challenge `status` flips to `active` (the `on_goal_inserted` trigger). Both dashboards now show the live challenge.
- [ ] **Step 5:** Edge checks: (a) both tap "Run it back" → only one challenge is created (the second tap accepts). (b) Decline → forming challenge deleted. (c) Withdraw via the waiting screen → deleted. (d) Start a different challenge while a rematch is pending → the rematch row disappears. (e) "Copy my goals from last challenge" pre-fills setup.
- [ ] **Step 6:** Update `ref/accountabilibuddies/ROADMAP.md` to note rematch shipped (move/annotate accordingly), and commit.

---

## Verification summary

After all tasks: a buddy can rematch with one tap + an in-app accept (no link), both set goals in parallel, and the existing DB trigger activates the challenge once both finalise — with idempotency, decline/withdraw/expiry/auto-void cleanup, and accept-time dates that obey Part A's per-user-midnight completion. No activation code was added (the trigger is reused), and `challengeTime.ts` (Part A) governs when the rematch challenge later completes.
