# Scheduled Challenge Start — Design Spec

**Date:** 2026-05-29
**Status:** Approved for implementation

---

## Problem

We want to share a link with not-yet-users ahead of June so they can sign up, create a challenge, and set goals *now* — but have it not officially begin (go checkable / count toward scores) until a chosen future date like **01/06**.

Today this is broken. The DB trigger `activate_challenge_if_ready()` flips a challenge `pending → active` purely on *both buddies having ≥5 goals* — it **never looks at `start_date`**. So a challenge dated June 1 goes live the instant the second person finishes their goals, with two concrete breakages:

- `DashboardClient` renders the full live board and shows **"Day 1"** even though the start is days away (the day-number is clamped up from a negative value).
- `toggleCheckIn` has no date guard, so pre-start check-ins land **outside the scoring window** (`start_date … today`) and silently don't count.

## Solution overview

Mirror the **ended-on-read** pattern already shipped (Part A timezone work): don't add a new status or cron — gate the *display* on the date.

- **Dashboard becomes three-way:** not-started-yet → a countdown card; else over → completion card (existing); else → live board (existing). The check uses the per-user-midnight helper so each buddy's board goes live at *their own* local midnight on the start date.
- **Goals stay editable until the challenge actually starts** (not merely until activation), so the pre-start window is useful — both buddies can still tweak goals while waiting.
- **A past-date guard** on creation closes the footgun of a fat-fingered start date producing a broken/half-elapsed challenge.

No schema change. No new status. No new cron. The onboarding link is the existing `/auth/signup`.

### Onboarding model (already decided)

Each recipient of the share message **creates their own challenge and invites a buddy** (not "join one shared challenge"). So the share link is simply `/auth/signup`: new user signs up → lands on the create form → picks **June 1** as the start → invites their buddy. No new onboarding surface is built; the scheduled-start gate below is what makes "set up now, begins June 1" behave correctly.

---

## The pre-start window, precisely

The window this feature governs is **after activation but before `start_date`**:

```
create (pending) ─ set goals ─ invite ─ buddy accepts ─ buddy sets goals
                                                              │ trigger fires (both ≥5 goals)
                                                              ▼
        pending ───────────────────────────────────────► active ──────────────► (start_date) ──► live
        (invite / waiting UI, unchanged)            NEW: NotStartedCard          DashboardClient
                                                    + goals still editable        (live board)
```

- While **pending** (buddy hasn't joined or hasn't finished goals): existing dashboard pending UI (invite link / waiting state) is unchanged. This is the natural "waiting for people to join" state for the June campaign.
- The trigger only flips to `active` once **both** have ≥5 goals, so by the time the new `NotStartedCard` can appear, **both goal sets exist** — the card can confidently say "you're both set."
- `start_date` and the "over" window never overlap (start is always 29 days before end), so the three display states are mutually exclusive.

---

## Section 1 — Timezone helper (`lib/challengeTime.ts`)

One small helper, symmetric with the existing `isChallengeOver`, reusing the DST-correct `zonedMidnightUtc`:

```ts
/** True once `now` is at/past 00:00 on `startDate` in `tz` (the user's local start). null tz → UTC. */
export function hasChallengeStarted(now: Date, startDate: string, tz: string | null): boolean {
  return now.getTime() >= zonedMidnightUtc(startDate, tz).getTime()
}
```

Each buddy's board goes live at **their own** local midnight on the start date — consistent with the Part A principle (server-side decisions use the stored timezone; client display uses the live local clock; `TimezoneSync` keeps the stored value fresh). Buddies in different timezones may cross the line a few hours apart; that's correct — each experiences "their" June 1.

## Section 2 — Dashboard display gate (`app/dashboard/page.tsx`)

In the **active** branch, after goals/check-ins are fetched (~line 229) and **before** the existing ended-on-read check, add the not-started gate. The current user's profile (`meProfile`) and the buddy's (`buddyProfile`) are derived the same way the rest of the function does (`creator_id === user.id ? creator : buddy`).

```ts
const meProfile = (typedChallenge.creator_id === user.id ? typedChallenge.creator : typedChallenge.buddy) as Profile | null
const buddyProfile = (typedChallenge.creator_id === user.id ? typedChallenge.buddy : typedChallenge.creator) as Profile | null

// Not-started-on-read: an active challenge whose start_date hasn't arrived (in this
// user's timezone) shows a countdown, not a checkable board. Mirrors ended-on-read.
if (!hasChallengeStarted(new Date(), typedChallenge.start_date, meProfile?.timezone ?? null)) {
  return (
    <div className="max-w-md mx-auto mt-12 px-6">
      <NotStartedCard
        challengeId={typedChallenge.id}
        challengeName={typedChallenge.month_name}
        startDate={typedChallenge.start_date}
        myName={firstNameOf(meProfile)}
        buddyName={firstNameOf(buddyProfile)}
      />
    </div>
  )
}
```

Resulting branch order in the active section: **not-started** → **over (ended-on-read)** → **live board**.

## Section 3 — `NotStartedCard` component (`components/dashboard/NotStartedCard.tsx`)

New component, styled to match `CompletionCard` (brand gradient, white text). Contents:

- Eyebrow: `CHALLENGE SCHEDULED`
- Challenge name (e.g. "June Challenge")
- `🗓️ Starts {Month Day}` (e.g. "Starts June 1") — formatted from `startDate`
- A **live countdown** — "3 days to go" / "Starts tomorrow" / "Starts today" — computed from the **browser's local date** (same source `DashboardClient` uses for `today`), so it's always fresh without a server round-trip.
- Reassurance line: "You and {buddyName} are all set."
- A **"Review your goals →"** link to `/setup?challenge={challengeId}` (goals are still editable pre-start — see Section 4).

The countdown is its own tiny **client** sub-component (the card itself can stay a server component, or the whole card can be a client component — implementer's call). Day math:

```ts
// local "today" midnight vs local start midnight, both from YYYY-MM-DD parts
const days = Math.round((startMidnightLocal - todayMidnightLocal) / 86400000)
// days <= 0 → "Starts today"; days === 1 → "Starts tomorrow"; else `${days} days to go`
```

(`days <= 0` is a transient edge — the server gate uses stored tz and the client uses live local time; if they momentarily disagree at the boundary, "Starts today" is the graceful fallback. The board takes over on the next server render.)

## Section 4 — Goals editable until start (`app/setup/actions.ts`)

`saveGoals` currently hard-blocks edits whenever `status === 'active'` (line 43). Relax it to block only once the challenge has **actually started**:

```ts
// add start_date to the select
const { data: challenge, error: challengeError } = await supabase
  .from('challenge_months').select('id, status, start_date')
  .eq('id', challengeId)
  .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
  .maybeSingle()
// ... existing null / error handling ...

const { data: profile } = await supabase
  .from('profiles').select('timezone').eq('id', user.id).maybeSingle()

if (challenge.status === 'active'
    && hasChallengeStarted(new Date(), challenge.start_date, profile?.timezone ?? null)) {
  return { error: 'Goals are locked once the challenge starts.' }
}
```

- Pending challenges: editable (unchanged).
- Active **but not yet started**: editable (new — this is the feature).
- Active **and started**: locked (unchanged behaviour, improved message).

`app/setup/page.tsx` already renders the editor for any challenge the user belongs to regardless of status, so the `NotStartedCard` "Review your goals" link reaches it with no page change.

**Copy fix:** `app/setup/page.tsx` currently tells users "You can't change these once your buddy joins." That was never quite true (goals lock on *activation*, not on join) and is now actively misleading. Change to: **"You can change these any time before the challenge starts."**

## Section 5 — Past-date guard on creation

A start date in the past silently produces a broken/half-elapsed challenge. Two cheap guards:

**Client** — `components/dashboard/CreateChallengeForm.tsx`: add `min={defaultDate}` to the date input so the native picker won't offer past dates.

```tsx
<input name="start_date" type="date" required min={defaultDate}
  value={startDate} onChange={e => handleStartChange(e.target.value)} ... />
```

**Server** — `app/dashboard/actions.ts` `createChallenge`, after the existing `start` parse/validate: reject a start more than one day before UTC-today (the one-day slack absorbs timezone skew so a legitimately-today start is never wrongly rejected):

```ts
import { addDays } from '@/lib/dateUtils'
// ...
const todayUtc = new Date().toISOString().split('T')[0]
if (startDate < addDays(todayUtc, -1)) {
  return { error: "Start date can't be in the past." }
}
```

This does not affect the June flow (June 1 is in the future) — it only closes the footgun.

---

## Edge cases

- **Buddy in a different timezone:** each sees the board go live at their own local midnight on `start_date`. Intended.
- **Both finish goals exactly on `start_date`:** trigger fires, `hasChallengeStarted` is already true → straight to the live board (no countdown flash). Correct.
- **Stored tz vs live local tz disagree at the midnight boundary:** server gate (stored tz) may render the countdown for a few minutes after the client thinks it's started, or vice-versa; the live counter's `days <= 0 → "Starts today"` keeps it graceful, and the next server render resolves it. Same accept-the-skew tradeoff as the rest of the timezone work.
- **Past-dated challenge created before this ships:** `hasChallengeStarted` returns true → live board, exactly as today. No migration needed.

## Out of scope (noted, not building)

- Editing a challenge's `start_date` after creation (no UI; recreate if wrong).
- A "smart default to the 1st" in the create form (users set June 1 manually).
- A server-side date guard inside `toggleCheckIn` — the board isn't rendered pre-start, so a pre-start check-in is only reachable via a hand-crafted request; low value for a friends-only app. Easy to add later as defense-in-depth if desired.

## Testing

- **Unit (`lib/challengeTime.ts`):** `hasChallengeStarted` — before/at/after midnight for a null tz and a non-null tz (e.g. a west-of-UTC zone where the local start lands at a different UTC instant); DST reuse is already covered by `zonedMidnightUtc`'s tests.
- **Manual / integration:**
  1. Create a challenge starting 2 days out, set goals on both sides → dashboard shows `NotStartedCard` with "2 days to go", board hidden, no check-in UI.
  2. Open `/setup` from the card → edit and re-save goals successfully (no "locked" error).
  3. Set start to today (or wait) → board renders, "Day 1", check-ins work, re-saving goals now returns the "locked once the challenge starts" error.
  4. Create form rejects a past start date (client `min` blocks it; server returns the error if bypassed).
