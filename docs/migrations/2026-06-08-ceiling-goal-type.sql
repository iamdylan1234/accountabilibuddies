-- 2026-06-08 — New 'ceiling' goal type (cap you stay under).
-- The goals.type CHECK constraint must permit the new value before any
-- ceiling rows can be written (insert via setup, or migrating an existing
-- cumulative goal). Run in the Supabase SQL Editor.
--
-- The constraint name is the Postgres default (<table>_<column>_check). If it
-- was named differently in this org, adjust the DROP line to match
-- (\d goals in the SQL editor shows the actual name).

ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_type_check;

ALTER TABLE goals ADD CONSTRAINT goals_type_check
  CHECK (type IN ('daily', 'milestone', 'frequency', 'cumulative', 'ceiling'));
