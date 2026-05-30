# CASCADE FK Audit — Pre-flight for Account Deletion

**Date:** 2026-05-30
**Purpose:** Verify every FK that references `profiles.id` or `auth.users.id` has `ON DELETE CASCADE`, so `supabase.auth.admin.deleteUser()` cascades correctly.

## Method

`DATABASE_URL` is not present in `.env.local`, and Supabase hosted PostgREST does not expose `information_schema`, so a live query was not possible. The FK constraints were reconstructed from the authoritative schema sources in this repo: the initial schema SQL in `docs/superpowers/plans/2026-04-30-accountabilibuddies.md`, the `goal_change_requests` CREATE TABLE in `docs/superpowers/plans/2026-05-02-v2-goals-redesign.md`, and the two applied migrations in `docs/migrations/`. The result should be cross-checked in Supabase Dashboard → SQL Editor using the query in the **SQL used** section below.

## Result

| Source table | Column | References | Delete rule |
|---|---|---|---|
| `public.profiles` | `id` | `auth.users(id)` | CASCADE |
| `public.challenge_months` | `creator_id` | `public.profiles(id)` | CASCADE |
| `public.challenge_months` | `buddy_id` | `public.profiles(id)` | SET NULL |
| `public.challenge_months` | `proposed_to` | `public.profiles(id)` | CASCADE |
| `public.challenge_months` | `rematch_of` | `public.challenge_months(id)` | SET NULL |
| `public.goals` | `challenge_id` | `public.challenge_months(id)` | CASCADE |
| `public.goals` | `user_id` | `public.profiles(id)` | CASCADE |
| `public.check_ins` | `goal_id` | `public.goals(id)` | CASCADE |
| `public.check_ins` | `user_id` | `public.profiles(id)` | CASCADE |
| `public.reactions` | `check_in_id` | `public.check_ins(id)` | CASCADE |
| `public.reactions` | `from_user_id` | `public.profiles(id)` | CASCADE |
| `public.push_subscriptions` | `user_id` | `auth.users(id)` | CASCADE |
| `public.goal_change_requests` | `goal_id` | `public.goals(id)` | CASCADE |
| `public.goal_change_requests` | `challenge_id` | `public.challenge_months(id)` | CASCADE |
| `public.goal_change_requests` | `requester_id` | `public.profiles(id)` | **NO ACTION** |

## Verdict

> **Action required.** The following FK does NOT use CASCADE:
>
> - `public.goal_change_requests.requester_id` → `profiles(id)` — defined in the `goal_change_requests` CREATE TABLE without an `ON DELETE` clause (defaults to `NO ACTION`).
>
> Before Task 5 (`deleteAccount`) can ship, either:
> 1. Run a migration to add `ON DELETE CASCADE` to this FK (preferred — keeps deletion atomic), OR
> 2. Have `deleteAccount` explicitly `DELETE FROM goal_change_requests WHERE requester_id = $uid` before deleting the auth user (app-side ordering, more fragile).
>
> **All other FKs targeting `profiles.id` or `auth.users.id` use CASCADE or SET NULL.** The `buddy_id` SET NULL rule means a deleted user's completed challenges are not destroyed — their buddy retains the history, which is the correct behaviour.

> **Note on `challenge_months.buddy_id` (SET NULL):** This is intentional — when a user deletes their account mid-challenge, the challenge row is not deleted; the buddy retains it. `deleteAccount` does not need to handle this explicitly. The buddy will see "no active challenge" on next load.

## Recommended migration (if option 1 chosen)

```sql
-- 2026-05-30 — Fix missing ON DELETE CASCADE on goal_change_requests.requester_id
-- Run in Supabase Dashboard → SQL Editor.

ALTER TABLE goal_change_requests
  DROP CONSTRAINT goal_change_requests_requester_id_fkey;

ALTER TABLE goal_change_requests
  ADD CONSTRAINT goal_change_requests_requester_id_fkey
  FOREIGN KEY (requester_id)
  REFERENCES profiles(id)
  ON DELETE CASCADE;
```

(The exact constraint name may differ — verify with `\d goal_change_requests` in psql or the SQL Editor before running.)

## SQL used

Run this in Supabase Dashboard → SQL Editor to confirm the live state:

```sql
SELECT
  tc.table_schema || '.' || tc.table_name AS source_table,
  kcu.column_name AS source_column,
  ccu.table_schema || '.' || ccu.table_name AS references_table,
  ccu.column_name AS references_column,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (ccu.table_name = 'profiles' OR (ccu.table_schema = 'auth' AND ccu.table_name = 'users'))
ORDER BY source_table, source_column;
```
