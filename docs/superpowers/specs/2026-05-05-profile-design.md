# Profile Page — Design Spec

**Date:** 2026-05-05  
**Status:** Approved for implementation  
**Deferred:** Friends system (separate spec)

---

## Goal

Give every user a personal profile that surfaces their identity (avatar), their achievements (stats), and their history (past challenges). The profile is accessed from the navbar — it does not become a new main tab. Sign-out moves off the navbar and into the profile page.

---

## What We're Building

1. **Navbar update** — avatar circle replaces the sign-out button
2. **Profile page** (`/profile`) — avatar, name, stats, challenge history, sign-out
3. **Avatar picker** — DiceBear style selector (bottom sheet, 30 styles)
4. **Stats tiles** — four tappable achievement tiles
5. **Challenge history** — scrollable list of all challenges, each tappable
6. **Wrap-up history view** — existing Summary tab extended to support any challenge by ID

---

## Architecture

### Database change

Add one column to `profiles`:

```sql
ALTER TABLE profiles ADD COLUMN avatar_style text NOT NULL DEFAULT 'avataaars';
```

The `avatar_url` column already exists but is unused. It stays — it's the hook for a future "upload real photo" feature. For now, avatar display is always computed from DiceBear using `avatar_style` + user ID as seed.

### Avatar URL pattern

```
https://api.dicebear.com/9.x/{avatar_style}/svg?seed={userId}
```

No storage. No API key. Renders as a standard `<img>` tag anywhere in the app.

### TypeScript type update

```ts
// types/database.ts
export interface Profile {
  id: string
  name: string
  avatar_url: string | null      // reserved for future photo upload
  avatar_style: string           // DiceBear style slug, default 'avataaars'
  notification_time: string
  created_at: string
}
```

### New route

`app/profile/page.tsx` — RSC that fetches the user's profile, all their challenges, all their check-ins across all challenges. Passes data to `ProfileClient`.

### Modified route

`app/wrap-up/page.tsx` — accepts optional `?challenge=<id>` search param. When present, loads that specific challenge instead of the most recent one. Adds a back-to-profile link when in history mode.

### New files

```
app/profile/
  page.tsx             RSC — data fetching
  loading.tsx          Skeleton loader

components/profile/
  ProfileClient.tsx    Main client component
  AvatarPicker.tsx     Bottom sheet — 30 DiceBear style options
  StatTile.tsx         Single tappable stat tile
  StreakDetailSheet.tsx Bottom sheet — best streak detail + current vs best
  ChallengeHistoryCard.tsx  Single challenge row
```

### Modified files

```
app/layout.tsx                        Fetch profile in root layout, pass avatar to Navbar
components/layout/Navbar.tsx          Replace sign-out with avatar circle, accept avatarUrl prop
components/wrap-up/ScoreSummary.tsx   Accept isHistorical + backHref props
app/wrap-up/page.tsx                  Accept optional challenge ID param
types/database.ts                     Add avatar_style to Profile
```

---

## Section 1 — Navbar Update

The brand bar currently has the app name on the left and a "Sign out" button on the right. The sign-out button is replaced with the user's avatar circle (32×32px, circular crop of the DiceBear SVG). Tapping it navigates to `/profile`.

The three main tabs (Today, This Week, Summary) are untouched.

```
Before: [Accountabilibuddies]          [Sign out]
After:  [Accountabilibuddies]          [○ avatar]
```

The avatar in the navbar uses the same DiceBear URL pattern. It is fetched as part of the root layout so it's available on all pages without per-page re-fetching.

---

## Section 2 — Profile Page Layout

```
┌─────────────────────────────────┐
│  ← back (if entered from history)│  (hidden when accessed from navbar)
│                                 │
│         ○ large avatar          │  96×96px, tappable → AvatarPicker
│         Dylan Richards          │  user's full name
│         Active challenge        │  "Day 12 of 30 · Jan Challenge"
│         or "No active challenge"│
│                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │  3   │ │ 67%  │ │ 🔥14 │ │ 284  │  │  Stats row
│  │chall.│ │ wins │ │streak│ │check-│  │
│  └──────┘ └──────┘ └──────┘ └──────┘  │
│                                 │
│  CHALLENGE HISTORY              │
│  ┌─────────────────────────────┐│
│  │ Jan Challenge 2025    →     ││  Most recent first
│  │ vs Alex · 78% vs 65%  ✓ Win ││
│  │ Jan 1 – Jan 30              ││
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │ Dec Challenge 2024    →     ││
│  │ vs Alex · 54% vs 71%  ✗ Loss││
│  └─────────────────────────────┘│
│                                 │
│         [Sign out]              │  Bottom, destructive style
└─────────────────────────────────┘
```

The page is a standard scrollable RSC layout, same `max-w-4xl mx-auto px-4 py-6` container as every other page.

---

## Section 3 — Avatar Picker

Triggered by tapping the large avatar circle on the profile page. Uses the same bottom sheet pattern as `GoalCalendarSheet` (slide-up, backdrop, drag-to-close, swipe-down-to-dismiss).

**Content:**
- Header: "Choose your avatar" with close button
- Scrollable grid: 5 columns × 6 rows = 30 DiceBear styles
- Each cell: circular SVG avatar (48×48px) previewed with the user's own ID as seed
- Active style highlighted with a teal ring
- Style name label below each circle (small, 9px)
- Tapping a style saves immediately (optimistic update) and closes the sheet

**Saving:**
- Server action `updateAvatarStyle(style: string)` updates `profiles.avatar_style`
- Optimistic update via `useOptimistic` so the avatar changes instantly on screen
- On error: rolls back and shows a brief toast

**The 30 styles to show (in display order):**
adventurer, adventurer-neutral, avataaars, avataaars-neutral, big-ears, big-ears-neutral,
big-smile, bottts, bottts-neutral, croodles, croodles-neutral, dylan, fun-emoji,
glass, icons, identicon, initials, lorelei, lorelei-neutral, micah, miniavs,
notionists, notionists-neutral, open-peeps, personas, pixel-art, pixel-art-neutral,
rings, shapes, thumbs

---

## Section 4 — Stats

Four tiles in a `grid grid-cols-4` row, each using the same rounded-2xl card pattern as the rest of the app.

### Tile 1 — Challenges
- **Value:** count of all `completed` challenges the user participated in
- **Label:** "challenges"
- **Tap:** smooth scroll to the challenge history list below

### Tile 2 — Win Rate
- **Value:** `X%` — percentage of completed challenges where `myScore > buddyScore` (ties excluded from wins)
- **Label:** "win rate"
- **Tap:** opens a small inline breakdown — W / L / Tie counts (three separate numbers)

### Tile 3 — Best Streak 🔥
- **Value:** longest consecutive completion streak across all goals across all challenges
- **Label:** "best streak"  
- **Subtitle on tile:** goal title + buddy name (truncated) — e.g. *"Attend BJJ · Alex"*
- **Tap:** opens `StreakDetailSheet`

**StreakDetailSheet content:**
```
  🔥 Best: 14 days
  Attend BJJ — Jan Challenge with Alex
  Mar 3 – Mar 16 2025
  [mini read-only calendar highlighting those 14 days]

  ─────────────────────────

  ⚡ Current: 11 days
  Attend BJJ — active challenge
  3 days away from your best
```
The "X days away from your best" line disappears once the current streak exceeds the best (which then becomes the new best). When the current streak beats the all-time best, it shows "🎉 New personal best!" instead.

### Tile 4 — Check-ins
- **Value:** total count of completed check-ins across all challenges, all time
- **Label:** "check-ins"
- **Tap:** no detail (static stat)

### Streak computation

Best streak is computed server-side across all goals from all challenges. A new `getBestStreak` function in `lib/scoring.ts` accepts all goals + all check-ins and returns:

```ts
interface BestStreakResult {
  days: number
  goalTitle: string
  challengeName: string
  buddyName: string
  startDate: string   // YYYY-MM-DD
  endDate: string     // YYYY-MM-DD
}

// Logic: for each goal, walk its schedule_dates (or calendar days for daily goals)
// in reverse from the last check-in date. Count consecutive completed dates.
// Uses the same walking logic as getCurrentStreak but over the full history
// rather than stopping at today. Return the goal+challenge combo with the highest count.
```

Current streak uses the existing `getCurrentStreak` function on the active challenge's goals. Both run at page load server-side — no real-time needed.

---

## Section 5 — Challenge History

A vertically stacked list, most recent first, below the stats.

### ChallengeHistoryCard

Each card shows:
- Challenge name (bold)
- Date range — "Jan 1 – Jan 30, 2025"
- Buddy name — "vs Alex"
- Score comparison — "78% · 65%" (your score first)
- Result badge — **Win** (teal), **Loss** (red), **Tie** (gray), **In Progress** (gradient, for the active challenge)
- Chevron `›` to indicate tappable

Tap navigates to `/wrap-up?challenge=<id>`.

Active challenge (if any) appears at the top of the list with an "In Progress" badge.

### Wrap-up in history mode

When `/wrap-up?challenge=<id>` is loaded:
- Fetches that specific challenge + its goals + check-ins (same queries, different challenge ID)
- `ScoreSummary` receives `isHistorical={true}` prop
- In historical mode: edit buttons on goals are hidden, pending requests are hidden, "Start new challenge" CTA is hidden
- A "← Back to profile" link appears in the header banner area

---

## Section 6 — Sign Out

A single button at the very bottom of the profile page, below the challenge history list.

- Label: "Sign out"
- Style: small, muted — `text-sm text-gray-400 font-semibold` — not a prominent CTA
- Behaviour: same Supabase `signOut()` + redirect to `/` as current implementation
- The sign-out button is removed from the Navbar entirely

---

## Data Fetching

All profile data is fetched server-side in `app/profile/page.tsx` in a single parallel block:

```ts
const [profileRes, challengesRes, allCheckInsRes] = await Promise.all([
  supabase.from('profiles').select('*').eq('id', user.id).single(),
  supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .order('created_at', { ascending: false }),
  supabase
    .from('check_ins')
    .select('goal_id, date, completed, value, user_id')
    .eq('user_id', user.id)
    .eq('completed', true),
])
```

Goals are fetched separately only to compute the best streak (need goal metadata to walk schedule_dates). All stats are computed server-side and passed as props — no client-side stat computation.

---

## Implementation Order

Build in this sequence — each step is independently deployable:

1. **DB migration** — add `avatar_style` column, update `Profile` type
2. **DiceBear avatar helper** — `lib/avatar.ts` exports `getAvatarUrl(userId, style)` utility
3. **Navbar update** — replace sign-out with avatar circle → `/profile`
4. **Profile page scaffold** — `/profile` route, layout, name, active challenge line, sign-out button (stats + history as placeholders)
5. **Avatar picker** — `AvatarPicker` bottom sheet, save action, optimistic update
6. **Stats tiles** — `StatTile` component, server-side stat computation, all four tiles
7. **StreakDetailSheet** — best streak detail + current vs best comparison
8. **Challenge history list** — `ChallengeHistoryCard`, ordered list
9. **Wrap-up history mode** — extend `/wrap-up` to accept `?challenge=<id>`, `isHistorical` prop on `ScoreSummary`

---

## Out of Scope (This Spec)

- Friends system
- Real photo upload (avatar_url field reserved but unused)
- Push notification settings (notification_time field exists — future profile section)
- Profile visibility / privacy settings
- Editing your name from the profile page
