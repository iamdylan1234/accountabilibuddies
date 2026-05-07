# Buddy Message Speech Bubble — Design Spec

**Date:** 2026-05-07
**Status:** Approved for implementation

---

## Problem

The Today tab shows scores and goals, but there's no channel for the two buddies to communicate encouragement or intent. Users have to context-switch to another app just to say "crushing it today" or "skipping the gym, will make it up tomorrow."

## Solution

Add a two-column message row between the score tiles and Today's Goals. Each column shows that person's daily message (today only; stale messages are hidden). Your own column is tappable and opens a bottom sheet to type a message (up to 150 chars). Buddy's column is read-only.

---

## Behaviour

### Message lifecycle

- A message is **active** if `profile.message_date === today` (ISO YYYY-MM-DD, compared in the client's local timezone).
- A message is **stale** if `message_date` is before today or null. Stale messages are not shown — the column renders an empty/placeholder state instead.
- Each time a user saves a message, `message_date` is set to today. So a message lives for exactly one day.

### Layout

The row appears **between the score tiles and the `space-y-6` goal sections**, only when a buddy exists. It uses the same two-column split as `GoalPairGrid` (50/50, `gap-3`).

**Left column (my message):**
- If today's message exists: show bubble text + subtle "edit" affordance
- If no today message: show gray placeholder text "Add a message…"
- Always tappable → opens `MessageEditSheet`

**Right column (buddy's message):**
- If today's message exists: show bubble text
- If no today message: show nothing (empty column, no placeholder)
- Read-only; tapping does nothing

### MessageEditSheet

- Slides up from bottom (same visual pattern as `GoalCalendarSheet`)
- Textarea pre-filled with current message (empty if none today)
- 150-char limit, shows `X / 150` counter
- **Save** button: calls `updateDailyMessage`, closes sheet
- **Clear** button (only visible when text is non-empty): sets empty string, calls `updateDailyMessage`, closes sheet — removes the tile from buddy's view
- Backdrop tap or swipe-down closes without saving

---

## Schema

```sql
ALTER TABLE profiles ADD COLUMN daily_message text DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN message_date date DEFAULT NULL;
```

**Prerequisite:** User must run this migration in Supabase before deploying.

---

## Type Update

Add to `Profile` interface in `types/database.ts`:

```ts
daily_message: string | null
message_date: string | null
```

---

## New Components

### `BuddyMessageRow` (`components/dashboard/BuddyMessageRow.tsx`)

**Props:**
```ts
interface Props {
  myProfile: Profile
  buddyProfile: Profile | null
  today: string
  onEditOpen: () => void
}
```

**Behaviour:**
- `myMessage` = `myProfile.message_date === today ? myProfile.daily_message : null`
- `buddyMessage` = `buddyProfile?.message_date === today ? buddyProfile.daily_message : null`
- If both messages are null AND buddyProfile exists: still render (my side shows placeholder)
- If buddyProfile is null: don't render anything (return null)

**My column:**
```tsx
<button onClick={onEditOpen} className="...">
  {myMessage
    ? <span className="text-sm text-gray-800">{myMessage}</span>
    : <span className="text-sm text-gray-400 italic">Add a message…</span>
  }
</button>
```

**Buddy column:**
```tsx
<div className="...">
  {buddyMessage && <span className="text-sm text-gray-700">{buddyMessage}</span>}
</div>
```

**Styling:**
- Both columns: `rounded-xl px-3 py-2.5 min-h-[44px] flex items-center`
- My column: `bg-teal-50 border border-teal-200 text-left w-full`
- Buddy column: `bg-gray-50 border border-gray-200 w-full` (empty border when no message keeps layout stable)

### `MessageEditSheet` (`components/dashboard/MessageEditSheet.tsx`)

**Props:**
```ts
interface Props {
  currentMessage: string   // empty string if no message today
  onClose: () => void
}
```

**Internal state:** `text: string` (initialised from `currentMessage`)

**Save flow:**
1. `await updateDailyMessage(text.trim())`
2. `onClose()`

**Clear flow (button only visible when `text !== ''`):**
1. `await updateDailyMessage('')`
2. `onClose()`

**Pending state:** disable Save/Clear, show spinner, while server action is in flight.

**Styling:** Same bottom-sheet pattern as `GoalCalendarSheet` — fixed bottom-0, white rounded-t-3xl, backdrop overlay.

---

## Server Action

**Add to `app/dashboard/checkin-actions.ts`:**

```ts
export async function updateDailyMessage(message: string): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const today = new Date().toISOString().split('T')[0]   // UTC date; acceptable for a daily message
  const { error } = await supabase
    .from('profiles')
    .update({ daily_message: message || null, message_date: message ? today : null })
    .eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/dashboard')
}
```

---

## Realtime Subscription

**Modify `components/dashboard/useDashboardRealtime.ts`:**

Add a `profiles` channel that subscribes to the buddy's row. On change, call `router.refresh()`.

Pattern (same as existing `check_ins` subscription):
```ts
.channel('profiles')
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'profiles',
  filter: `id=eq.${buddyId}`,
}, () => { setIsRefreshing(true); router.refresh() })
.subscribe()
```

---

## DashboardClient Changes

1. Import `BuddyMessageRow` and `MessageEditSheet`.
2. Add `const [messageSheetOpen, setMessageSheetOpen] = useState(false)` state.
3. After `<ScoreTileGrid .../>` and before `<div className="space-y-6">`, insert:
   ```tsx
   {buddy && (
     <BuddyMessageRow
       myProfile={myProfile!}
       buddyProfile={buddy}
       today={today}
       onEditOpen={() => setMessageSheetOpen(true)}
     />
   )}
   ```
4. At bottom of return (alongside the existing `GoalCalendarSheet` sheet), add:
   ```tsx
   {messageSheetOpen && (
     <MessageEditSheet
       currentMessage={myProfile?.message_date === today ? (myProfile?.daily_message ?? '') : ''}
       onClose={() => setMessageSheetOpen(false)}
     />
   )}
   ```

---

## Edge Cases

| Case | Behaviour |
|------|-----------|
| No buddy | `BuddyMessageRow` returns null — row not rendered |
| Both messages null | Row renders; my side shows "Add a message…"; buddy side empty |
| Message saved yesterday | Treated as stale — not shown |
| `message_date` is null | Treated as stale — not shown |
| Buddy sets message while I'm on page | Realtime triggers `router.refresh()` → buddy column updates |
| User clears message | `daily_message = null, message_date = null` → tile disappears from buddy's view |
| 150-char limit | Enforced by `maxLength={150}` on textarea AND server-side trim |

---

## Testing

- No unit tests for components (visual)
- Manual verification checklist (after deploy):
  1. No message yet → my column shows "Add a message…"
  2. Tap my column → sheet opens pre-filled (empty on first use)
  3. Type message, save → my column shows message text
  4. Buddy opens app → sees my message in their buddy column
  5. Tomorrow, my message is gone (stale)
  6. Clear button removes message immediately
  7. Buddy's real-time message update reflects without page reload
