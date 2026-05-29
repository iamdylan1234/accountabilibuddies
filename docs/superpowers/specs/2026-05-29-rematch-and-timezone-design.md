# Buddy Rematch + Per-User-Midnight Timezone — Design Spec

**Date:** 2026-05-29
**Status:** Approved for implementation

---

## Problem

Two related gaps in the challenge lifecycle:

1. **No way to continue with the same buddy.** When a challenge ends, continuing with the same person means the full first-time flow — create challenge → set goals → copy an invite link → buddy opens it → buddy sets goals. That friction kills the month-to-month renewal loop, which for a *buddy* app is the core retention mechanic.

2. **Challenge completion is timezone-wrong.** The completion cron runs in UTC and (after the interim fix) completes a challenge once the UTC date rolls past `end_date`. For users west of UTC this can end their final day hours before their local midnight, and there's no notion of "don't finish until *both* buddies' final day is over."

These intersect: a rematch creates a new challenge whose start/end boundaries should obey the timezone rules.

## Solution overview

- **Part A — Per-user-midnight (foundation):** store each user's timezone; use it only for server-side decisions that run with no client present (the completion cron + challenge boundary checks). A shared challenge completes at the **later** of the two buddies' local midnights, so neither is cut short. Interactive features already use the live client clock and stay untouched.
- **Part B — Rematch:** a "Run it back" button on the completion card creates a *forming* challenge pre-targeted at the last buddy and pushes them an in-app proposal. Both set goals in parallel (proposer immediately, recipient on accept); the challenge goes active once both have finalised. Idempotent, with decline/withdraw/expiry cleanup.

The two parts decompose into **two implementation plans** (Part A first — the rematch's dates depend on its boundary rule).

---

# Part A — Per-User-Midnight Timezone

## Principle

When a **client is present**, the browser's live local clock is the most accurate source of "what day is it for this user" (knows current offset, DST, travel — zero staleness). When **no client is present** (server jobs), fall back to a **stored** timezone as the best approximation.

- Interactive actions (check-ins, streaks, today's-goals, buzz cap, daily message) → already use the client's local date (the phone sends `today`). **Unchanged.**
- Server jobs (completion cron, boundary checks) → use the stored timezone. **This is the only gap being closed.**

This achieves "every function respects each user's real midnight" via the correct mechanism per context — *not* by forcing everything through one stale-able store (which would reduce accuracy for the interactive paths and carry large regression risk for no benefit).

## Schema

```sql
ALTER TABLE profiles ADD COLUMN timezone text DEFAULT NULL;  -- IANA, e.g. "Europe/Amsterdam"; null → UTC
```

## Capture / refresh

A client effect on app load reads `Intl.DateTimeFormat().resolvedOptions().timeZone` and calls a lightweight server action `updateTimezone(tz)` **only if it differs** from `profiles.timezone`. Because users open the app regularly, the stored value the cron reads stays fresh. No onboarding step required; it self-populates on first authenticated load.

`updateTimezone`:
```ts
export async function updateTimezone(tz: string): Promise<void> {
  // validate tz against Intl.supportedValuesOf('timeZone') (ignore unknown values),
  // then update profiles.timezone where id = auth user AND timezone IS DISTINCT FROM tz
}
```

## Completion rule

A challenge completes once the current instant is past the **later** of the two buddies' "midnight after `end_date`":

```
boundary(user)  = the UTC instant of 00:00 on (end_date + 1 day) in user's timezone (null tz → UTC)
completeAt      = max(boundary(creator), boundary(buddy))
complete when:  now_utc >= completeAt
```

- "Don't cut anyone short": the easternmost buddy's final day ends first, but completion waits for the westernmost buddy's midnight too.
- **Self-healing:** the `>=` comparison means any active challenge already past `completeAt` is caught on the *next* run, so a missed run never strands a challenge.

Computing "00:00 on a date in a timezone, as a UTC instant" must be DST-correct — use `Intl.DateTimeFormat` with `timeZone` (or a small tz utility). The implementation plan details the helper; this spec defines the rule.

The cron also: scores both sides (`scoreChallenge(..., useTargetCount=true)`, the existing call), determines winner/tie, sends the wrap-up email to both, and (Part B) **sweeps expired rematch proposals** (deletes forming challenges past their 14-day expiry).

## Cron frequency (Vercel Hobby = daily)

Vercel Hobby caps cron jobs at **once per day**, so the sweep runs daily at `0 0 * * *` (already configured). Consequence: the *status flip + email* can lag up to ~24h for far-west users (the challenge is over either way; only the durable completion lags).

To keep the **in-app experience instant and correct** despite the daily flip, the dashboard treats a challenge whose `completeAt` has already passed as **ended on read** — it renders the completion card instead of a stale "active" challenge the user could wrongly try to check into. The cron remains the authoritative flip + email backstop. (Same boundary helper as the cron, evaluated at request time.)

## Unchanged

Check-ins, streaks, today's-goals selection, the buzz 1/day cap, daily-message date — all keep using the client-supplied local date. They are already per-user-correct and carry no server-side date decision that the stored tz would improve.

---

# Part B — Buddy Rematch

## Model

A rematch is a thin layer over the **existing** create → setup → active pipeline, with the janky parts removed (no link to share; buddy auto-invited by push). The flow:

1. **Propose** — "Run it back with [buddy]" on the completion card creates a *forming* challenge (a pending `challenge_months` row, creator = proposer, `rematch_of` = the finished challenge, `proposed_to` = the last buddy, `buddy_id` = null, dates not yet set) and pushes the buddy. The proposer goes straight to goal setup and can enter goals **immediately**.
2. **Accept** — the recipient taps Accept: `buddy_id` = themselves, `proposed_to` cleared, **dates lock in** (`start_date` = tomorrow, `end_date` = start + 29), name auto-set. They go to goal setup and enter goals **immediately**, in parallel — neither buddy waits for the other.
3. **Drop in** — once **both** have finalised goals, the challenge flips to `active` via the existing both-have-goals transition (untouched).

"Forming challenge created on propose" (rather than "nothing until both agree") is the deliberate trade-off that lets the proposer set goals at propose time. No orphans linger because forming challenges are **deleted** on decline / withdraw / expiry / either party starting a different challenge.

## Schema

```sql
ALTER TABLE challenge_months ADD COLUMN rematch_of  uuid DEFAULT NULL
  REFERENCES challenge_months(id) ON DELETE SET NULL;       -- lineage for a future history/stats view
ALTER TABLE challenge_months ADD COLUMN proposed_to uuid DEFAULT NULL
  REFERENCES profiles(id) ON DELETE CASCADE;                -- intended buddy before they accept

-- Idempotency: at most one rematch per finished challenge.
CREATE UNIQUE INDEX uniq_challenge_rematch_of ON challenge_months(rematch_of)
  WHERE rematch_of IS NOT NULL;
```

No separate proposals table — the forming `challenge_months` row *is* the proposal. State is derived from columns:

| State | `status` | `proposed_to` | `buddy_id` |
|-------|----------|---------------|------------|
| Normal pending (link invite) | `pending` | null | null |
| Rematch proposed (pre-accept) | `pending` | recipient | null |
| Rematch accepted (pre-goals) | `pending` | null | recipient |
| Active | `active` | null | recipient |

## State machine & actions

- **`proposeRematch(finishedChallengeId)`** — validates: caller was a participant, that challenge is `completed`, and caller has no active/pending challenge. Inserts the forming challenge (relies on `UNIQUE(rematch_of)`). On unique violation (a proposal already exists for that finished challenge), routes to **accept** instead (this is the "both tapped Run it back" convergence). Sends the recipient a push. Redirects proposer to `/setup`.
- **`acceptRematch(challengeId)`** — validates caller is the `proposed_to`. Sets `buddy_id` = caller, clears `proposed_to`, sets `start_date` = tomorrow (caller's local date + 1) and `end_date` = start + 29, sets the auto-name. Redirects to `/setup`.
- **`declineRematch(challengeId)`** — validates caller is `proposed_to`. Deletes the forming challenge (cascades goals). Proposer sees it gone (in-app).
- **`withdrawRematch(challengeId)`** — validates caller is the creator (proposer). Deletes the forming challenge.
- **Auto-void** — if either party starts/joins a different challenge while a rematch is pending, the forming challenge is deleted (a participant can only be in one challenge at a time).
- **Auto-expire** — the daily cron deletes forming rematch challenges (`status='pending'` AND `proposed_to IS NOT NULL` AND `created_at < now − 14 days`).

## Dates & naming

- `start_date` = the day after acceptance (the accepter's local "tomorrow"); `end_date` = `start_date + 29` (rolling 30-day; matches existing `createChallenge`).
- These are single date strings shared by both buddies, but each buddy *lives* them in their own timezone — day 1 begins at each user's local midnight on `start_date`, and completion waits for the later local midnight after `end_date` (Part A). Cross-tz buddies thus have slightly offset day windows over the same calendar dates, which is exactly how check-ins already behave.
- Auto-name from the start month, e.g. *"June Challenge"*. The exact span is shown explicitly wherever the rematch surfaces (proposal, accept screen, waiting state): *"Runs Jun 4 – Jul 3 (30 days)"* / *"Starts tomorrow"*.

## Goals

Both sides land on the normal goal-setup. Setup gains a **"Copy my goals from last challenge"** button that pre-fills the user's previous 5 goals (editable). Cloning is opt-in, never automatic.

## Notification

Proposing sends the recipient a push: **"[Proposer first name] wants to run it back 🤜🤛"** — reusing the existing web-push infra (`sendBuzz`-style send to the recipient's `push_subscriptions`). This is consistent with the user-driven-only notification policy (it fires only because a human tapped "Run it back"). It is a second notification *type* alongside the daily buzz, explicitly approved.

## UI surfaces

- **Completion card** (already built, `CompletionCard`): when eligible (you have a completed challenge and no active/pending), the primary CTA becomes **"🤜🤛 Run it back with [buddy]"**; shows the proposed span.
- **Recipient proposal card** on Today: *"[Proposer] wants to run it back · Jun 4 – Jul 3"* + **Accept** / **Decline**.
- **Proposer waiting state** (their pending dashboard, branched on `proposed_to`): *"Waiting for [buddy] to accept · expires in 14 days"* + **Withdraw**. Once the proposer has set their goals: *"Your goals are set — waiting for [buddy]."* (Replaces the invite-link screen for rematch-forming challenges.)
- **Setup:** the "Copy my goals from last challenge" button.

---

## Edge cases & non-goals

| Case | Behaviour |
|------|-----------|
| Both tap "Run it back" at once | `UNIQUE(rematch_of)` — second insert fails, re-routed to accept the first. One challenge. |
| Recipient declines | Forming challenge deleted; proposer's goals discarded; proposer may re-propose. |
| Proposer withdraws | Forming challenge deleted. |
| Either starts a different challenge while pending | Forming challenge deleted (one challenge at a time). |
| 14 days pass with no accept | Daily cron deletes the forming challenge. |
| Accepted but recipient never finalises goals | Stays `pending` (buddy attached) until they do — same as today's join-but-no-goals state. |
| Cross-timezone buddies | Completion waits for the later midnight; the easterner simply has no days left to log in the gap. |
| Null `timezone` | Treated as UTC for boundary math. |
| Proposer/recipient already in an active/pending challenge | "Run it back" hidden / `proposeRematch` rejects. |

**Non-goals:** no group/multi-buddy rematch; "rematch with a *different* buddy" is just a normal new challenge; no recurring/auto-rematch; no timezone retrofit of the interactive (client-local) functions; no per-user *display* of a partially-completed cross-tz challenge beyond "active until later boundary".

## Testing

**Part A (unit):**
- Boundary helper: 00:00-on-date-in-tz → correct UTC instant across several zones incl. a DST transition and null→UTC.
- `completeAt` = max of both boundaries; "complete when now ≥ completeAt"; self-healing for a past-due challenge.
- Dashboard "ended on read": a challenge past `completeAt` renders as completed even with `status='active'`.

**Part B (unit):**
- `proposeRematch` idempotency: second propose re-routes to accept (no duplicate row).
- Date math: `start` = accept-day + 1, `end` = start + 29.
- Decline / withdraw / expiry delete the forming challenge.
- "Copy my goals" pre-fills the previous 5.
- State-table derivation (pending+proposed_to vs pending+buddy_id vs active).

**Manual (post-deploy):** full propose → push → accept → both set goals in parallel → active, on two devices in two timezones; verify completion at the later midnight and the wrap-up email.

## Open questions

None. Sequencing note: implement **Part A first** (the rematch's accept-time date boundaries depend on the per-user-midnight rule), then Part B.
