-- 2026-05-29 — Buddy rematch (Part B). Applied to production via Supabase SQL Editor.

ALTER TABLE challenge_months ADD COLUMN rematch_of  uuid DEFAULT NULL REFERENCES challenge_months(id) ON DELETE SET NULL;
ALTER TABLE challenge_months ADD COLUMN proposed_to uuid DEFAULT NULL REFERENCES profiles(id) ON DELETE CASCADE;

-- At most one rematch per finished challenge (idempotency for double-tap).
CREATE UNIQUE INDEX uniq_challenge_rematch_of ON challenge_months(rematch_of) WHERE rematch_of IS NOT NULL;
