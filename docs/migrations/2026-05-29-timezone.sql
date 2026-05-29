-- 2026-05-29 — Per-user-midnight timezone (Part A)
-- Applied to production via Supabase SQL Editor.

ALTER TABLE profiles ADD COLUMN timezone text DEFAULT NULL;  -- IANA tz, e.g. "Europe/Amsterdam"; null → UTC
