# Accountabilibuddies — Design Spec
Date: 2026-04-30

## Overview

Accountabilibuddies is a web app for two friends to run a shared accountability challenge over a calendar month. One person creates the challenge and invites the other via a link. Each person sets 5–8 goals, logs progress daily, and can see their buddy's progress in real time. Weekly and end-of-month summaries keep both people engaged.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + routing | Next.js (App Router) |
| Auth + database + real-time | Supabase |
| Email notifications | Resend (free tier) |
| Hosting | Vercel (auto-deploys from GitHub) |

---

## Visual Design

- **Style:** Bold and motivating — energetic, strong, goal-oriented
- **Gradient:** Teal (#00C9A7) → Blue (#0077B6)
- **Accent:** Yellow (#F9F871) for today's date, highlights, scores
- **Background:** White with light teal tints for completed states
- **Typography:** Bold sans-serif (Inter or similar), heavy weights for headings
- **Tone:** Competitive but friendly — two friends pushing each other

---

## Database Schema

### `profiles`
| Column | Type | Notes |
|---|---|---|
| id | uuid | References auth.users |
| name | text | Display name |
| avatar_url | text | Optional |
| notification_time | time | User's preferred daily reminder time |

### `challenge_months`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| creator_id | uuid | User who created the challenge |
| buddy_id | uuid | User who accepted the invite (nullable until joined) |
| invite_token | text | Unique token for invite link |
| month_name | text | e.g. "November Challenge" |
| start_date | date | First day of the challenge |
| end_date | date | Last day of the challenge |
| status | enum | `pending` (awaiting buddy), `active` (both joined, month running), `completed` (end_date passed) |

### `goals`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| challenge_id | uuid | References challenge_months |
| user_id | uuid | Goal owner |
| title | text | e.g. "Run 5km" |
| type | enum | `daily`, `milestone`, `frequency` |
| target_count | integer | Only used for frequency goals (e.g. 15) |
| created_at | timestamptz | |

Goals are locked once the challenge becomes `active`.

### `check_ins`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| goal_id | uuid | References goals |
| user_id | uuid | Who logged this |
| date | date | The day being logged |
| completed | boolean | Did they do it? |
| created_at | timestamptz | |

For frequency goals, each check-in represents one completion. For daily/milestone, one check-in per date.

### `reactions`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| check_in_id | uuid | The check-in being reacted to |
| from_user_id | uuid | Who sent the reaction |
| emoji | text | e.g. "🔥", "💪", "👏" |
| created_at | timestamptz | |

---

## Pages & Routes

| Route | Description |
|---|---|
| `/` | Landing page — what is the app, sign up / log in CTAs |
| `/auth/login` | Login screen |
| `/auth/signup` | Sign up screen |
| `/dashboard` | Main daily screen — today's goals side by side |
| `/setup` | Goal setup — add 5–8 goals before challenge starts |
| `/month` | Monthly progress view with drill-down |
| `/invite/[token]` | Join page — buddy lands here from invite link |
| `/wrap-up` | Weekly and end-of-month summary screen |

---

## Key User Flows

### Creating a Challenge
1. Sign up → verify email (Supabase auth)
2. Click "Start a challenge month"
3. Name the challenge, pick a start date
4. Add 5–8 goals (name, type, target count if frequency)
5. Copy invite link → send to friend
6. Wait for friend to join before challenge goes `active`

### Joining a Challenge
1. Open invite link → `/invite/[token]`
2. Sign up or log in
3. Add 5–8 goals
4. Both users are now ready — challenge becomes `active`

### Daily Use
1. Open app → dashboard shows today's date and both people's goals side by side
2. Tap a goal to log it (toggles completed)
3. Buddy's goals update in real time (Supabase real-time subscription)
4. Tap any completed check-in on buddy's side to leave a reaction (🔥 💪 👏 ❤️)

---

## Dashboard Screen

**Layout: Side by Side**

- Header: gradient banner with challenge name, "Day X of 30", today's date
- Two columns: **You** | **[Buddy Name]**
- Each column shows:
  - Overall score for today (e.g. 3/5 goals)
  - List of goals with tick/untick for yours, read-only + reaction button for buddy's
  - Completed goals shown in teal, incomplete in grey
- Real-time: buddy's column updates live without page refresh

---

## Monthly Progress Screen

**Layout: Progress Bars + Drill-Down**

- Overall completion bar for each person (goals hit ÷ total possible across the month)
- Per-goal rows showing count (e.g. "Run 5km — 9/12 days" or "Exercise — 8/15 times")
- Tap any goal row → drill-down view showing a mini calendar for that goal: each day colour-coded (teal = done, grey = missed, yellow = today, future days blank)
- Both your goals and buddy's goals shown (toggle between the two)

---

## Notifications

| Trigger | Channel | Phase | Timing |
|---|---|---|---|
| Daily reminder | Push only | Phase 2 | User's chosen time (set during onboarding) |
| Missed yesterday | Push only | Phase 2 | 9am the following morning if no check-ins logged |
| Sunday wrap-up | Email (+ Push in Phase 2) | Phase 1 | Every Sunday at 9am |
| End of month | Email (+ Push in Phase 2) | Phase 1 | Final day of challenge |

**Sunday wrap-up email content:**
- Week number and date range
- Each person's completion % for the week
- Goals each person is on track vs behind on
- Simple motivational message

**Sunday in-app weekly plan (new feature):**
On Sundays, the dashboard shows a "This Week's Plan" panel above the goal columns. For each goal it calculates how many completions are needed this week to stay on track for the monthly target, and suggests which specific days to do them.

Calculation logic:
- **Daily goals:** need 7 completions this week (or fewer if the month ends before Sunday)
- **Frequency goals:** `ceil((target - completions_so_far) / remaining_weeks)` completions needed this week, distributed across the week's days
- **Milestone goals:** if not yet done, show "Complete this week!" with Wednesday as the suggested day

Day allocation: spread the required completions across the week evenly, skipping days already past (shown Mon–Sun). If more completions are needed than days remain, mark every remaining day.

**End of month email content:**
- Final scores for both people
- Per-goal breakdown
- Winner highlight (friendly)
- CTA: "Start a new challenge"

Push notifications (Phase 2): For MVP, only email is implemented. Push notification infrastructure (service workers, web push) is deferred to the next phase.

---

## End of Month Scoring

- **Score** = average of per-goal scores × 100%
- Daily goals: days completed ÷ total days in challenge
- Frequency goals: min(1, times completed ÷ target count) — capped at 100% if target exceeded
- Milestone goals: 1.0 if completed, 0.0 if not
- Scores shown side by side on the wrap-up screen
- "Winner" highlighted in yellow — framed as friendly, not harsh
- Prompt to start a new challenge appears after results

---

## Goal Types

| Type | Description | Example | How it's logged |
|---|---|---|---|
| Daily | Must be done every day | "Read 20 pages" | Tick/untick each day |
| Milestone | Complete once in the month | "Finish my CV" | Single tick, stays green |
| Frequency | Hit a target number of times | "Exercise 30 mins × 15" | Each tap adds one completion |

---

## Real-Time

Supabase real-time subscriptions on the `check_ins` and `reactions` tables. When a buddy logs a goal or leaves a reaction, the dashboard updates instantly for the other person with no page refresh required.

---

## MVP Scope (Phase 1)

**In scope:**
- Full auth (sign up, log in, log out)
- Create challenge, invite buddy, join via link
- Goal setup (all three types)
- Daily dashboard with side-by-side view
- Monthly progress view with drill-down
- Reactions on buddy's check-ins
- Real-time updates
- Email notifications (Sunday wrap-up, end of month) via Resend
- End of month scoring and summary screen

**Deferred to Phase 2:**
- Push notifications (daily reminder, missed-day nudge)
- Multiple simultaneous challenge months
- Profile photos / avatars
- Challenge history / past months archive
