-- 2026-05-27 — Buddy Buzz Notifications
-- Applied to production: 2026-05-27 by Dylan via Supabase SQL Editor.

ALTER TABLE profiles ADD COLUMN last_buzz_date date DEFAULT NULL;

CREATE TABLE push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own subs only" ON push_subscriptions
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
