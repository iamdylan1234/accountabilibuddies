# Profile & Settings Rework — Design Spec

**Date:** 2026-05-30
**Status:** Approved for implementation
**Bar:** Commercial-grade (App Store / paid user expectations), not just "better than today."

---

## Problem

Profile today is a kitchen-sink scroll: identity + lifetime stats + challenge history + one settings toggle + sign-out, all stacked in one undifferentiated list with no labeled sections. To a user comparing this to Strava / Duolingo / Spotify / WhatsApp, it reads as homemade rather than commercial.

Specific failures:

- **Settings are hidden.** The BuzzToggle — the *only* settings control in the entire app — is buried at the bottom of the scroll, with no "Settings" header. To mute notifications, a user must scroll past their entire challenge history.
- **Can't edit your own name** despite displaying it.
- **No account deletion.** Hard requirement for App Store / GDPR — this alone makes Profile a blocker for paid launch.
- **No Privacy Policy / Terms of Service surface.** Required for App Store, payments, EU users.
- **No customer support contact.**
- **No version display.**
- **No clear primary action.** Every other tab has an obvious "what do I do here." Profile does not.
- **Active challenge line is wasted real estate.** Passive gray text, not tappable.

## Solution overview

Adopt the **two-surface pattern** used by every commercial app: separate **Profile** (achievement-focused — who you are, what you've done) from **Settings** (control-focused — what you change). Gear-icon navigation: ⚙ in Profile top-right → opens a dedicated `/settings` screen. Within Settings, group controls by category (Account, Notifications, About) with consistent labeled section headers — same visual pattern as iOS Settings / Apple Health / Spotify / Duolingo.

This is structural, not cosmetic. It separates concerns, gives breathing room, and creates a natural home for future commercial features (subscription, buddy preferences, data export) without requiring another rework.

---

## Surface 1 — Profile tab (`/profile`)

Lean, achievement-focused.

### Layout

```
┌─────────────────────────────────┐
│                          ⚙      │  ← Gear icon top-right → /settings (NEW)
│           [Avatar]              │
│            Dylan                │
│  ┌───────────────────────────┐  │
│  │ May Challenge          → │  │  ← Active-challenge card (NEW)
│  │ Day 15 of 30              │  │     replaces existing static gray text
│  └───────────────────────────┘  │     tappable → /dashboard
│                                 │
│  STATS                          │  ← Existing section + tiles, unchanged
│  [Completed] [Win] [Streak] [✓] │
│                                 │
│  CHALLENGE HISTORY              │  ← Existing, unchanged
│  [card] [card] [card]           │
└─────────────────────────────────┘
```

### Active-challenge card

Replaces the existing `<p>Day 15 of 30 · May Challenge</p>` gray text line.

- **When there IS an active challenge:** brand-gradient card, `rounded-xl`, full-width, `py-3 px-4`. Left column: challenge name (white bold) + "Day X of Y" (white/70 smaller). Right side: chevron `→`. Tap → `/dashboard`.
- **When there is NO active challenge:** keep the existing subtle "No active challenge" gray text line, unchanged. (Could become an "Start a challenge →" CTA in a later pass; out of scope for v1.)

### Removed from Profile

- **BuzzToggle** — moves to Settings → Notifications.
- **Sign out** — moves to Settings → About.

---

## Surface 2 — Settings screen (`/settings`)

New screen, reached via gear icon. Standard iOS-style grouped settings: gray background, white grouped rows with subtle dividers, uppercase section labels above each group.

### Top bar

`← Profile` (back link, top-left, gray) · centered title "Settings".

### Section: Account

| Row | Behavior |
|---|---|
| **Name** | Shows current name + chevron. Tap → `NameEditSheet` bottom sheet: single text input pre-filled with current name, 1–50 chars validation, Save action calls `updateName` server action. |
| **Email** | Shows current email, read-only (no chevron). Email change is Phase 2. |
| **Password** | Right-aligned "Change" + chevron. Tap → triggers Supabase `auth.resetPasswordForEmail(user.email)` and shows a toast: *"Check your email for a reset link."* Reuses existing `/auth/reset-password` page. |
| **Delete account** | Red text, no chevron. Tap → `DeleteAccountSheet`: explains what gets deleted (account + all challenges + goals + check-ins + push subscriptions), requires typing `DELETE` in an input to enable the destroy button. On confirm: `deleteAccount` server action removes the auth user via admin client; DB CASCADE handles related rows; client signs out + redirects to `/`. |

### Section: Notifications

| Row | Behavior |
|---|---|
| **Buddy buzz** | Settings row with inline toggle on the right. Reuses existing `BuzzToggle` logic (subscribe / unsubscribe + push_subscriptions row CRUD), restyled to match settings row aesthetic. |

### Section: About

| Row | Behavior |
|---|---|
| **Privacy Policy** | Chevron → `/privacy` |
| **Terms of Service** | Chevron → `/terms` |
| **Support** | Shows `help@accountabilibuddies.app` + mail icon → `mailto:help@accountabilibuddies.app` |
| **Version** | Shows app version (read from `package.json` at build time). No tap action. |
| **Sign out** | Gray text, no chevron. Tap → `supabase.auth.signOut()` + redirect to `/`. |

---

## Surface 3 — Privacy + Terms pages (`/privacy`, `/terms`)

New static server-component pages. Shared `LegalPage` layout component.

**Content:** placeholder boilerplate. Each page renders a **prominent yellow/amber banner** at the top:

> ⚠️ **Draft — not legally reviewed.** This text is placeholder boilerplate. It must be replaced with text reviewed by a lawyer before any paid launch or App Store submission.

This visible banner serves as both a TODO for Dylan and a clear signal to any user reading these pre-launch. The pages must exist (App Store / GDPR) even with placeholder content; real legal copy is Phase 2 and explicitly out of scope here.

**Layout:** brand-gradient header strip with page title, scrollable content with headed sections (Introduction, Data We Collect, How We Use It, Your Rights, Contact, etc. for Privacy; Acceptance, Use of Service, Termination, Liability, Changes for Terms), back-to-settings link at the bottom.

---

## Decisions baked in (override during spec review if needed)

1. **Privacy/Terms text** — stub with placeholder boilerplate + a visible "needs legal review" amber banner. Real text required before paid launch.
2. **Delete account confirmation** — type-DELETE pattern. Higher friction by design; standard for irreversible destructive actions in commercial apps.
3. **Support email** — `help@accountabilibuddies.app`. Requires Dylan to set up the inbox or forward to his real email. Mailto in v1; in-app contact form is Phase 2.
4. **Settings access pattern** — gear icon in Profile top-right (not in the global Navbar). Standard 2-tap path: tap Navbar avatar → Profile → tap gear → Settings.
5. **Sub-section depth** — Settings uses **bottom sheets** for in-place editing (NameEditSheet, DeleteAccountSheet), not separate sub-routes. Sub-routes become Phase 2 if any section grows complex (subscription billing, multi-device, etc.).
6. **Password change** — trigger reset email, don't build an in-app password-change form. Reuses existing infrastructure; safer (reset link verifies email control).

---

## Schema notes

**No schema changes required.** Account deletion relies on existing `ON DELETE CASCADE` rules on related FKs. The plan's **Task 0** is a pre-flight verification: for each table that references `profiles.id` (or `auth.users.id`), confirm CASCADE is set. Tables involved:

- `goals.user_id`
- `check_ins.user_id`
- `push_subscriptions.user_id`
- `reactions.from_user_id`
- `challenge_months.creator_id`
- `challenge_months.buddy_id`
- `goal_change_requests.requested_by` (if exists)
- (any other table referencing profiles)

If any FK lacks CASCADE, the `deleteAccount` server action must add explicit cleanup ordering — caught in Task 0 before code is written.

---

## Edge cases

- **User in an active challenge when they delete:** With CASCADE on `challenge_months.creator_id`/`buddy_id`, the row deletes. The buddy will see "no active challenge" on next load and can start fresh. Acceptable for v1. A "your buddy left" notification is Phase 2.
- **Password reset with email-confirmation off:** Supabase's `resetPasswordForEmail` works regardless of the confirm-email setting. Verified.
- **Mailto with no mail client:** Opens whatever the OS configures; if nothing, fails silently. Acceptable degradation; the email address is also displayed inline as a fallback.
- **Version read at build time:** `process.env.npm_package_version` (Next.js sets this) or imported from `package.json` via a build constant. Falls back to a hardcoded constant if unavailable.
- **Name edit collides with display:** `Navbar` shows the avatar but not the name; `Profile` shows the name in one place. Updating one profile row + a `revalidatePath('/profile')` + the `router.refresh()` already in place handles propagation.

---

## Out of scope (Phase 2, when monetized)

- Email change flow (`auth.updateUser({ email })` + confirmation)
- Real legal copy reviewed by a human (REQUIRED before paid launch — flagged on the page itself)
- Subscription / billing area
- Buddy preferences (who can buzz me, quiet hours, etc.)
- Data export (CSV download)
- Sub-routes for sections that grow
- "Your buddy left" notification when one party deletes mid-challenge
- In-app contact form (vs. mailto)

---

## Testing

- **Manual smoke** (covered in plan's verification task):
  1. Tap gear → Settings opens with all three sections rendered.
  2. Edit name → reflects in Profile tab.
  3. Tap Password Change → email arrives, reset link works.
  4. Toggle Buddy buzz → push_subscriptions row appears/disappears.
  5. Privacy + Terms pages render with the amber banner.
  6. Mailto support row launches mail client.
  7. Version row shows the right number.
  8. Sign out → lands on `/` and the layout no longer shows the navbar.
  9. Delete account in incognito with a throwaway: type DELETE, confirm, redirect to `/`, can't sign back in, related challenges no longer visible.

- **No unit tests** for new components (matches repo convention).
- **tsc + production build** as the verification gate.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `app/settings/page.tsx` | create | Server component; loads profile + active challenge; renders SettingsClient |
| `app/settings/actions.ts` | create | Server actions: `updateName`, `triggerPasswordReset`, `deleteAccount` |
| `components/settings/SettingsClient.tsx` | create | Client wrapper holding sheet open-state + sign-out handler |
| `components/settings/SettingsSection.tsx` | create | Section wrapper (uppercase label + grouped white card) |
| `components/settings/SettingsRow.tsx` | create | Row variants: nav, value, action, toggle |
| `components/settings/NameEditSheet.tsx` | create | Bottom sheet for name editing |
| `components/settings/DeleteAccountSheet.tsx` | create | Bottom sheet with type-DELETE confirmation |
| `app/privacy/page.tsx` | create | Static legal page with amber banner |
| `app/terms/page.tsx` | create | Static legal page with amber banner |
| `components/legal/LegalPage.tsx` | create | Shared layout: header strip + content + back link |
| `components/profile/ProfileClient.tsx` | modify | Slim down (remove BuzzToggle + Sign out); add gear icon; replace active-challenge text line with tappable card |
