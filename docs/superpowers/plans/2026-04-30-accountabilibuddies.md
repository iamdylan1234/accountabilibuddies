# Accountabilibuddies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack accountability web app where two friends set and track 5–8 goals together over a challenge month, with real-time progress sharing, reactions, and email summaries.

**Architecture:** Next.js App Router with server components for initial data fetching and client components for real-time interactions. Supabase handles auth, PostgreSQL, and real-time subscriptions. Emails sent via Resend from Next.js API routes triggered by Vercel Cron Jobs. Scoring is a pure function tested independently.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, `@supabase/ssr`, `@supabase/supabase-js`, Resend, Jest + React Testing Library

---

## File Map

```
middleware.ts                               # Redirect unauthenticated users
types/database.ts                           # TypeScript types for all DB tables

lib/supabase/client.ts                      # Browser Supabase client
lib/supabase/server.ts                      # Server Supabase client
lib/scoring.ts                              # Pure scoring functions
lib/email.ts                                # Resend email sending

components/layout/Navbar.tsx                # Top nav bar
components/dashboard/DashboardClient.tsx    # Real-time wrapper (client component)
components/dashboard/GoalCard.tsx           # Single goal tile
components/dashboard/ReactionPicker.tsx     # Emoji reaction overlay
components/goals/GoalSetupForm.tsx          # Add goals form
components/month/ProgressView.tsx           # Monthly progress bars
components/month/GoalDrillDown.tsx          # Per-goal calendar detail
components/wrap-up/ScoreSummary.tsx         # End of month score comparison

app/layout.tsx                              # Root layout with nav
app/globals.css                             # Tailwind + brand tokens
app/page.tsx                                # Landing page
app/auth/login/page.tsx                     # Login
app/auth/signup/page.tsx                    # Sign up
app/auth/callback/route.ts                  # Supabase auth redirect handler
app/dashboard/page.tsx                      # Daily dashboard (server wrapper)
app/setup/page.tsx                          # Goal setup
app/month/page.tsx                          # Monthly progress
app/invite/[token]/page.tsx                 # Accept invite
app/wrap-up/page.tsx                        # Summary screen
app/api/cron/weekly/route.ts                # Sunday wrap-up email
app/api/cron/monthly/route.ts               # End of month email

vercel.json                                 # Cron job schedule
jest.config.js                              # Test config
jest.setup.ts                               # jest-dom matchers
```

---

## Task 1: Install Dependencies and Configure Testing

**Files:**
- Modify: `package.json` (via npm install)
- Create: `jest.config.js`
- Create: `jest.setup.ts`

- [ ] **Step 1: Install runtime dependencies**

Run in the `accountabilibuddies` directory (use cmd terminal):
```
npm install @supabase/ssr resend
```
Expected: `added X packages` with no errors.

- [ ] **Step 2: Install test dependencies**

```
npm install --save-dev jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom @types/jest ts-jest
```
Expected: `added X packages` with no errors.

- [ ] **Step 3: Create jest.config.js**

```js
const nextJest = require('next/jest')
const createJestConfig = nextJest({ dir: './' })
module.exports = createJestConfig({
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  testPathPattern: ['**/__tests__/**/*.test.ts?(x)'],
})
```

- [ ] **Step 4: Create jest.setup.ts**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add test script to package.json**

In `package.json`, find the `"scripts"` section and add:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 6: Verify jest runs**

```
npm test -- --passWithNoTests
```
Expected: `Test Suites: 0 passed` with no config errors.

- [ ] **Step 7: Commit**

```
git add -A
git commit -m "chore: add supabase/ssr, resend, jest test setup"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `types/database.ts`

- [ ] **Step 1: Create types/database.ts**

```ts
export type GoalType = 'daily' | 'milestone' | 'frequency'
export type ChallengeStatus = 'pending' | 'active' | 'completed'

export interface Profile {
  id: string
  name: string
  avatar_url: string | null
  notification_time: string
  created_at: string
}

export interface ChallengeMonth {
  id: string
  creator_id: string
  buddy_id: string | null
  invite_token: string
  month_name: string
  start_date: string
  end_date: string
  status: ChallengeStatus
  created_at: string
}

export interface Goal {
  id: string
  challenge_id: string
  user_id: string
  title: string
  type: GoalType
  target_count: number | null
  created_at: string
}

export interface CheckIn {
  id: string
  goal_id: string
  user_id: string
  date: string
  completed: boolean
  created_at: string
}

export interface Reaction {
  id: string
  check_in_id: string
  from_user_id: string
  emoji: string
  created_at: string
}

// Joined types used in components
export interface GoalWithCheckIns extends Goal {
  check_ins: CheckIn[]
}

export interface ChallengeWithProfiles extends ChallengeMonth {
  creator: Profile
  buddy: Profile | null
}
```

- [ ] **Step 2: Commit**

```
git add types/database.ts
git commit -m "feat: add TypeScript database types"
```

---

## Task 3: Database Schema

This task runs SQL in the Supabase dashboard — no code files are created.

- [ ] **Step 1: Open the Supabase SQL Editor**

Go to your Supabase project → click **SQL Editor** in the left sidebar → click **New query**.

- [ ] **Step 2: Run the schema SQL**

Paste and run the following:

```sql
-- Profiles (one per auth user)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  avatar_url text,
  notification_time time default '20:00:00',
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Challenge months
create table challenge_months (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references profiles(id) on delete cascade not null,
  buddy_id uuid references profiles(id) on delete set null,
  invite_token text unique not null default encode(gen_random_bytes(16), 'hex'),
  month_name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'completed')),
  created_at timestamptz default now()
);

-- Goals
create table goals (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references challenge_months(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  type text not null check (type in ('daily', 'milestone', 'frequency')),
  target_count integer,
  created_at timestamptz default now()
);

-- Check-ins
create table check_ins (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references goals(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  completed boolean not null default true,
  created_at timestamptz default now()
);

-- Reactions
create table reactions (
  id uuid primary key default gen_random_uuid(),
  check_in_id uuid references check_ins(id) on delete cascade not null,
  from_user_id uuid references profiles(id) on delete cascade not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique(check_in_id, from_user_id)
);
```

Expected: All statements run without errors.

- [ ] **Step 3: Enable Row Level Security**

Run in a new SQL query:

```sql
alter table profiles enable row level security;
alter table challenge_months enable row level security;
alter table goals enable row level security;
alter table check_ins enable row level security;
alter table reactions enable row level security;

-- profiles: anyone can read, only owner can update
create policy "profiles_read" on profiles for select using (true);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- challenge_months: only participants can see/modify
create policy "challenges_read" on challenge_months for select
  using (auth.uid() = creator_id or auth.uid() = buddy_id);
create policy "challenges_insert" on challenge_months for insert
  with check (auth.uid() = creator_id);
create policy "challenges_update" on challenge_months for update
  using (auth.uid() = creator_id or auth.uid() = buddy_id);

-- goals: visible to challenge participants
create policy "goals_read" on goals for select
  using (
    exists (
      select 1 from challenge_months c
      where c.id = goals.challenge_id
      and (c.creator_id = auth.uid() or c.buddy_id = auth.uid())
    )
  );
create policy "goals_insert" on goals for insert
  with check (auth.uid() = user_id);
create policy "goals_delete" on goals for delete
  using (auth.uid() = user_id);

-- check_ins: visible to challenge participants
create policy "checkins_read" on check_ins for select
  using (
    exists (
      select 1 from goals g
      join challenge_months c on c.id = g.challenge_id
      where g.id = check_ins.goal_id
      and (c.creator_id = auth.uid() or c.buddy_id = auth.uid())
    )
  );
create policy "checkins_insert" on check_ins for insert
  with check (auth.uid() = user_id);
create policy "checkins_update" on check_ins for update
  using (auth.uid() = user_id);
create policy "checkins_delete" on check_ins for delete
  using (auth.uid() = user_id);

-- reactions: visible to challenge participants, insert by buddy
create policy "reactions_read" on reactions for select
  using (
    exists (
      select 1 from check_ins ci
      join goals g on g.id = ci.goal_id
      join challenge_months c on c.id = g.challenge_id
      where ci.id = reactions.check_in_id
      and (c.creator_id = auth.uid() or c.buddy_id = auth.uid())
    )
  );
create policy "reactions_insert" on reactions for insert
  with check (auth.uid() = from_user_id);
create policy "reactions_delete" on reactions for delete
  using (auth.uid() = from_user_id);
```

Expected: All policies created without errors.

- [ ] **Step 4: Enable real-time on check_ins and reactions**

In Supabase dashboard → **Database** → **Replication** → enable `check_ins` and `reactions` tables for real-time.

---

## Task 4: Supabase Clients and Auth Middleware

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Create lib/supabase/client.ts**

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create lib/supabase/server.ts**

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 3: Create middleware.ts**

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const protectedRoutes = ['/dashboard', '/setup', '/month', '/wrap-up']
  const isProtected = protectedRoutes.some(r =>
    request.nextUrl.pathname.startsWith(r)
  )

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  if (user && request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
```

- [ ] **Step 4: Create app/auth/callback/route.ts**

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/auth/login`)
}
```

- [ ] **Step 5: Commit**

```
git add lib/ middleware.ts app/auth/callback/
git commit -m "feat: supabase clients and auth middleware"
```

---

## Task 5: Global Styles and Layout

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Create: `components/layout/Navbar.tsx`

- [ ] **Step 1: Update app/globals.css**

Replace the entire file with:

```css
@import "tailwindcss";

:root {
  --teal: #00C9A7;
  --blue: #0077B6;
  --yellow: #F9F871;
  --teal-light: #E8FBF7;
}

body {
  font-family: 'Inter', sans-serif;
  background: #f8f9fa;
}
```

- [ ] **Step 2: Create components/layout/Navbar.tsx**

```tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Navbar() {
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="w-full px-6 py-4 flex items-center justify-between"
      style={{ background: 'linear-gradient(135deg, #00C9A7 0%, #0077B6 100%)' }}>
      <Link href="/dashboard" className="text-white font-black text-xl tracking-tight">
        Accountabilibuddies
      </Link>
      <div className="flex gap-4 items-center">
        <Link href="/month" className="text-white/80 hover:text-white text-sm font-semibold">
          Month
        </Link>
        <Link href="/wrap-up" className="text-white/80 hover:text-white text-sm font-semibold">
          Summary
        </Link>
        <button
          onClick={signOut}
          className="text-sm font-semibold px-4 py-1.5 rounded-full bg-white/20 text-white hover:bg-white/30 transition"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
```

- [ ] **Step 3: Update app/layout.tsx**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import { createClient } from '@/lib/supabase/server'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Accountabilibuddies',
  description: 'Track goals with your accountability buddy',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="en">
      <body className={inter.className}>
        {user && <Navbar />}
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Verify app compiles**

```
npm run dev
```

Open `http://localhost:3000`. Should redirect to `/auth/login` (which doesn't exist yet — a 404 is expected). No build errors in the terminal.

- [ ] **Step 5: Commit**

```
git add app/globals.css app/layout.tsx components/
git commit -m "feat: global styles, layout, and navbar"
```

---

## Task 6: Auth Pages (Sign Up and Login)

**Files:**
- Create: `app/auth/signup/page.tsx`
- Create: `app/auth/login/page.tsx`

- [ ] **Step 1: Create app/auth/signup/page.tsx**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Update profile name after signup
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ name }).eq('id', user.id)
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900">Create account</h1>
          <p className="text-gray-500 mt-1">Start your accountability journey</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Your first name"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="At least 6 characters"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-white text-sm transition"
            style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-semibold text-teal-600">Log in</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create app/auth/login/page.tsx**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900">Welcome back</h1>
          <p className="text-gray-500 mt-1">Log in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Your password"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-white text-sm transition"
            style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          No account?{' '}
          <Link href="/auth/signup" className="font-semibold text-teal-600">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Test auth manually**

Start dev server (`npm run dev`). Visit `http://localhost:3000/auth/signup`. Sign up with a test email and password. You should be redirected to `/dashboard` (404 for now — that's fine). Check Supabase → Authentication → Users to confirm the user was created.

- [ ] **Step 4: Commit**

```
git add app/auth/
git commit -m "feat: sign up and login pages"
```

---

## Task 7: Landing Page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace app/page.tsx**

```tsx
import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <div
        className="flex flex-col items-center justify-center flex-1 text-white px-6 py-24 text-center"
        style={{ background: 'linear-gradient(135deg, #00C9A7 0%, #0077B6 100%)' }}
      >
        <h1 className="text-5xl font-black tracking-tight mb-4">
          Accountabilibuddies
        </h1>
        <p className="text-xl text-white/80 max-w-md mb-10">
          Set goals. Track daily. Hold each other accountable. One month at a time.
        </p>
        <div className="flex gap-4">
          <Link
            href="/auth/signup"
            className="px-8 py-3 rounded-full font-bold text-sm"
            style={{ background: '#F9F871', color: '#0077B6' }}
          >
            Get started
          </Link>
          <Link
            href="/auth/login"
            className="px-8 py-3 rounded-full font-bold text-sm bg-white/20 hover:bg-white/30 transition"
          >
            Log in
          </Link>
        </div>
      </div>

      <div className="bg-white py-20 px-6">
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
          {[
            { title: 'Set Your Goals', desc: 'Choose 5–8 goals for the month — daily habits, one-time milestones, or frequency targets.' },
            { title: 'Track Together', desc: 'See your buddy\'s progress in real time. React with a cheer when they hit a goal.' },
            { title: 'Weekly Wrap-Ups', desc: 'Every Sunday get a summary of how you both did. End the month with a final score.' },
          ].map(item => (
            <div key={item.title} className="text-center">
              <h3 className="font-black text-lg text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify landing page**

Visit `http://localhost:3000/auth/login` (to bypass the middleware redirect for logged-in users). Sign out if logged in. Then visit `http://localhost:3000`. You should see the gradient landing page with two buttons.

- [ ] **Step 3: Commit**

```
git add app/page.tsx
git commit -m "feat: landing page"
```

---

## Task 8: Challenge Creation and Dashboard Shell

**Files:**
- Create: `app/dashboard/page.tsx`
- Create: `app/dashboard/actions.ts`

- [ ] **Step 1: Create app/dashboard/actions.ts**

This file holds server actions for creating a challenge.

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createChallenge(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const monthName = formData.get('month_name') as string
  const startDate = formData.get('start_date') as string

  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + 29)
  const endDate = end.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('challenge_months')
    .insert({
      creator_id: user.id,
      month_name: monthName,
      start_date: startDate,
      end_date: endDate,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  redirect(`/setup?challenge=${data.id}`)
}
```

- [ ] **Step 2: Create app/dashboard/page.tsx**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createChallenge } from './actions'
import type { ChallengeWithProfiles } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Find the user's active or pending challenge
  const { data: challenge } = await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .in('status', ['active', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // No challenge yet — show create form
  if (!challenge) {
    const today = new Date().toISOString().split('T')[0]
    return (
      <div className="max-w-md mx-auto mt-20 px-6">
        <h1 className="text-3xl font-black text-gray-900 mb-2">Start a challenge</h1>
        <p className="text-gray-500 mb-8">Create a challenge month and invite your buddy.</p>
        <form action={createChallenge} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Challenge name</label>
            <input
              name="month_name"
              type="text"
              required
              defaultValue="May Challenge"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Start date</label>
            <input
              name="start_date"
              type="date"
              required
              defaultValue={today}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-xl font-bold text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
          >
            Create challenge →
          </button>
        </form>
      </div>
    )
  }

  const typedChallenge = challenge as unknown as ChallengeWithProfiles

  // Challenge exists but no buddy yet
  if (typedChallenge.status === 'pending') {
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${typedChallenge.invite_token}`
    return (
      <div className="max-w-md mx-auto mt-20 px-6">
        <h1 className="text-3xl font-black text-gray-900 mb-2">{typedChallenge.month_name}</h1>
        <p className="text-gray-500 mb-8">Waiting for your buddy to join. Share this link:</p>
        <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
          <span className="text-sm text-gray-700 break-all flex-1">{inviteUrl}</span>
          <button
            onClick={() => navigator.clipboard.writeText(inviteUrl)}
            className="text-xs font-bold text-teal-600 whitespace-nowrap"
          >
            Copy
          </button>
        </div>
        <p className="text-sm text-gray-400 mt-4">
          Once your buddy joins and sets their goals, the challenge begins.
        </p>
      </div>
    )
  }

  // Active challenge — show full dashboard (Task 10)
  return (
    <div className="px-6 py-8">
      <p className="text-gray-500">Dashboard loading… (implemented in Task 10)</p>
    </div>
  )
}
```

- [ ] **Step 3: Add NEXT_PUBLIC_APP_URL to .env.local**

Open `.env.local` and add:
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 4: Test the create challenge flow**

Sign in → visit `/dashboard` → fill in challenge name and start date → submit. You should be redirected to `/setup?challenge=<id>` (404 for now). Check Supabase → Table Editor → `challenge_months` to confirm the row was created.

- [ ] **Step 5: Commit**

```
git add app/dashboard/ .env.local
git commit -m "feat: dashboard shell and challenge creation"
```

---

## Task 9: Goal Setup

**Files:**
- Create: `components/goals/GoalSetupForm.tsx`
- Create: `app/setup/page.tsx`
- Create: `app/setup/actions.ts`

- [ ] **Step 1: Create components/goals/GoalSetupForm.tsx**

```tsx
'use client'

import { useState } from 'react'
import type { Goal, GoalType } from '@/types/database'

interface GoalDraft {
  title: string
  type: GoalType
  target_count: string
}

const emptyGoal = (): GoalDraft => ({ title: '', type: 'daily', target_count: '' })

interface Props {
  challengeId: string
  existingGoals: Goal[]
  onSubmit: (goals: GoalDraft[]) => Promise<void>
}

export default function GoalSetupForm({ challengeId, existingGoals, onSubmit }: Props) {
  const [goals, setGoals] = useState<GoalDraft[]>(
    existingGoals.length > 0
      ? existingGoals.map(g => ({
          title: g.title,
          type: g.type,
          target_count: g.target_count?.toString() ?? '',
        }))
      : [emptyGoal()]
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function updateGoal(i: number, field: keyof GoalDraft, value: string) {
    setGoals(prev => prev.map((g, idx) => idx === i ? { ...g, [field]: value } : g))
  }

  function addGoal() {
    if (goals.length >= 8) return
    setGoals(prev => [...prev, emptyGoal()])
  }

  function removeGoal(i: number) {
    if (goals.length <= 1) return
    setGoals(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const filled = goals.filter(g => g.title.trim())
    if (filled.length < 5) {
      setError('Add at least 5 goals.')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit(filled)
    } catch (err) {
      setError(String(err))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {goals.map((goal, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
            <input
              type="text"
              value={goal.title}
              onChange={e => updateGoal(i, 'title', e.target.value)}
              placeholder="Goal name (e.g. Run 5km)"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            {goals.length > 1 && (
              <button type="button" onClick={() => removeGoal(i)}
                className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
            )}
          </div>
          <div className="flex gap-2 ml-7">
            {(['daily', 'milestone', 'frequency'] as GoalType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => updateGoal(i, 'type', t)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  goal.type === t
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                style={goal.type === t ? { background: 'linear-gradient(135deg, #00C9A7, #0077B6)' } : {}}
              >
                {t}
              </button>
            ))}
            {goal.type === 'frequency' && (
              <input
                type="number"
                value={goal.target_count}
                onChange={e => updateGoal(i, 'target_count', e.target.value)}
                placeholder="× how many times?"
                min="1"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            )}
          </div>
        </div>
      ))}

      {goals.length < 8 && (
        <button type="button" onClick={addGoal}
          className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-teal-400 hover:text-teal-500 transition font-semibold">
          + Add goal ({goals.length}/8)
        </button>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-xl font-bold text-white text-sm"
        style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
      >
        {submitting ? 'Saving…' : 'Save goals & continue →'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Create app/setup/actions.ts**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { GoalType } from '@/types/database'

interface GoalDraft {
  title: string
  type: GoalType
  target_count: string
}

export async function saveGoals(challengeId: string, goals: GoalDraft[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Delete existing goals first (allows re-setup before challenge is active)
  await supabase.from('goals').delete()
    .eq('challenge_id', challengeId)
    .eq('user_id', user.id)

  const rows = goals.map(g => ({
    challenge_id: challengeId,
    user_id: user.id,
    title: g.title,
    type: g.type,
    target_count: g.type === 'frequency' ? parseInt(g.target_count) || null : null,
  }))

  const { error } = await supabase.from('goals').insert(rows)
  if (error) throw new Error(error.message)

  redirect('/dashboard')
}
```

- [ ] **Step 3: Create app/setup/page.tsx**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GoalSetupForm from '@/components/goals/GoalSetupForm'
import { saveGoals } from './actions'

interface Props {
  searchParams: Promise<{ challenge?: string }>
}

export default async function SetupPage({ searchParams }: Props) {
  const params = await searchParams
  const challengeId = params.challenge

  if (!challengeId) redirect('/dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: challenge } = await supabase
    .from('challenge_months')
    .select('*')
    .eq('id', challengeId)
    .single()

  if (!challenge) redirect('/dashboard')

  const { data: existingGoals } = await supabase
    .from('goals')
    .select('*')
    .eq('challenge_id', challengeId)
    .eq('user_id', user.id)

  async function handleSave(goals: { title: string; type: string; target_count: string }[]) {
    'use server'
    await saveGoals(challengeId!, goals as any)
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <div
        className="rounded-2xl p-6 mb-8 text-white"
        style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
      >
        <p className="text-sm font-semibold opacity-80 uppercase tracking-wide mb-1">
          {challenge.month_name}
        </p>
        <h1 className="text-2xl font-black">Set your goals</h1>
        <p className="text-white/70 text-sm mt-1">Add 5–8 goals. You can't change these once your buddy joins.</p>
      </div>

      <GoalSetupForm
        challengeId={challengeId}
        existingGoals={existingGoals ?? []}
        onSubmit={handleSave}
      />
    </div>
  )
}
```

- [ ] **Step 4: Test goal setup**

From `/dashboard`, create a challenge. You'll land on `/setup?challenge=<id>`. Add 5 goals, mix the types, submit. You should redirect back to `/dashboard`. Check Supabase → `goals` table to confirm the rows.

- [ ] **Step 5: Commit**

```
git add components/goals/ app/setup/
git commit -m "feat: goal setup form"
```

---

## Task 10: Invite Flow

**Files:**
- Create: `app/invite/[token]/page.tsx`
- Create: `app/invite/[token]/actions.ts`

- [ ] **Step 1: Create app/invite/[token]/actions.ts**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function acceptInvite(token: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/signup?next=/invite/${token}`)

  const { data: challenge } = await supabase
    .from('challenge_months')
    .select('*')
    .eq('invite_token', token)
    .eq('status', 'pending')
    .single()

  if (!challenge) throw new Error('Invite not found or already used.')
  if (challenge.creator_id === user.id) throw new Error('You cannot join your own challenge.')

  const { error } = await supabase
    .from('challenge_months')
    .update({ buddy_id: user.id })
    .eq('id', challenge.id)

  if (error) throw new Error(error.message)

  redirect(`/setup?challenge=${challenge.id}`)
}
```

- [ ] **Step 2: Create app/invite/[token]/page.tsx**

```tsx
import { createClient } from '@/lib/supabase/server'
import { acceptInvite } from './actions'

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params

  const supabase = await createClient()
  const { data: challenge } = await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(name)')
    .eq('invite_token', token)
    .eq('status', 'pending')
    .single()

  if (!challenge) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-black text-gray-900">Invite not found</h1>
          <p className="text-gray-500 mt-2">This invite has already been used or doesn't exist.</p>
        </div>
      </div>
    )
  }

  const creator = challenge.creator as { name: string }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <div
          className="rounded-2xl p-8 text-white mb-6"
          style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
        >
          <p className="text-white/80 text-sm font-semibold uppercase tracking-wide mb-2">
            You've been invited
          </p>
          <h1 className="text-3xl font-black mb-1">{challenge.month_name}</h1>
          <p className="text-white/70 text-sm">by {creator.name}</p>
        </div>

        <p className="text-gray-500 text-sm mb-8">
          Join {creator.name}'s challenge, set your goals, and hold each other accountable.
        </p>

        <form action={acceptInvite.bind(null, token)}>
          <button
            type="submit"
            className="w-full py-3 rounded-xl font-bold text-sm"
            style={{ background: '#F9F871', color: '#0077B6' }}
          >
            Accept invite & set my goals →
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Test invite flow**

From the dashboard pending state, copy the invite URL. Open it in an incognito window. Sign up as a new user. You should land on `/setup?challenge=<id>`. Set goals and submit. Check Supabase — `challenge_months` should now have `buddy_id` set and status should still be `pending` (it becomes `active` once both have goals — we'll handle that transition next).

- [ ] **Step 4: Add a database trigger to activate the challenge**

In Supabase SQL Editor, run:

```sql
create or replace function activate_challenge_if_ready()
returns trigger as $$
declare
  creator_goal_count integer;
  buddy_goal_count integer;
  challenge_record record;
begin
  select * into challenge_record
  from challenge_months
  where id = new.challenge_id;

  if challenge_record.status != 'pending' then
    return new;
  end if;

  if challenge_record.buddy_id is null then
    return new;
  end if;

  select count(*) into creator_goal_count from goals
  where challenge_id = new.challenge_id and user_id = challenge_record.creator_id;

  select count(*) into buddy_goal_count from goals
  where challenge_id = new.challenge_id and user_id = challenge_record.buddy_id;

  if creator_goal_count >= 5 and buddy_goal_count >= 5 then
    update challenge_months set status = 'active' where id = new.challenge_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_goal_inserted
  after insert on goals
  for each row execute procedure activate_challenge_if_ready();
```

- [ ] **Step 5: Commit**

```
git add app/invite/
git commit -m "feat: invite flow and challenge activation trigger"
```

---

## Task 11: Dashboard — Active Challenge View

**Files:**
- Create: `components/dashboard/GoalCard.tsx`
- Create: `components/dashboard/ReactionPicker.tsx`
- Create: `components/dashboard/DashboardClient.tsx`
- Modify: `app/dashboard/page.tsx`
- Create: `app/dashboard/checkin-actions.ts`

- [ ] **Step 1: Create app/dashboard/checkin-actions.ts**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function toggleCheckIn(goalId: string, date: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: existing } = await supabase
    .from('check_ins')
    .select('id')
    .eq('goal_id', goalId)
    .eq('user_id', user.id)
    .eq('date', date)
    .single()

  if (existing) {
    await supabase.from('check_ins').delete().eq('id', existing.id)
  } else {
    await supabase.from('check_ins').insert({
      goal_id: goalId,
      user_id: user.id,
      date,
      completed: true,
    })
  }

  revalidatePath('/dashboard')
}

export async function addReaction(checkInId: string, emoji: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Upsert: replace existing reaction if there is one
  await supabase.from('reactions').upsert({
    check_in_id: checkInId,
    from_user_id: user.id,
    emoji,
  }, { onConflict: 'check_in_id,from_user_id' })

  revalidatePath('/dashboard')
}
```

- [ ] **Step 2: Create components/dashboard/ReactionPicker.tsx**

```tsx
'use client'

import { useState } from 'react'
import { addReaction } from '@/app/dashboard/checkin-actions'

const EMOJIS = ['🔥', '💪', '👏', '❤️', '⚡']

interface Props {
  checkInId: string
  existingEmoji?: string
}

export default function ReactionPicker({ checkInId, existingEmoji }: Props) {
  const [open, setOpen] = useState(false)

  async function handlePick(emoji: string) {
    setOpen(false)
    await addReaction(checkInId, emoji)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-lg leading-none hover:scale-110 transition-transform"
      >
        {existingEmoji ?? '😊'}
      </button>
      {open && (
        <div className="absolute bottom-8 right-0 bg-white rounded-xl shadow-lg border border-gray-100 p-2 flex gap-1 z-10">
          {EMOJIS.map(e => (
            <button
              key={e}
              onClick={() => handlePick(e)}
              className="text-xl hover:scale-125 transition-transform p-1"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create components/dashboard/GoalCard.tsx**

```tsx
import { toggleCheckIn } from '@/app/dashboard/checkin-actions'
import ReactionPicker from './ReactionPicker'
import type { Goal, CheckIn, Reaction } from '@/types/database'

interface Props {
  goal: Goal
  checkIn: CheckIn | null
  reaction: Reaction | null
  isMyGoal: boolean
  today: string
}

export default function GoalCard({ goal, checkIn, reaction, isMyGoal, today }: Props) {
  const done = !!checkIn

  if (isMyGoal) {
    return (
      <form action={toggleCheckIn.bind(null, goal.id, today)}>
        <button
          type="submit"
          className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition ${
            done ? 'text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
          }`}
          style={done ? { background: 'linear-gradient(135deg, #00C9A7, #0077B6)' } : {}}
        >
          <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
            done ? 'border-white bg-white/30' : 'border-gray-300'
          }`}>
            {done && <span className="text-white text-xs font-bold">✓</span>}
          </span>
          <span className="text-sm font-semibold flex-1">{goal.title}</span>
          {goal.type === 'frequency' && (
            <span className={`text-xs font-bold ${done ? 'text-white/70' : 'text-gray-400'}`}>
              ×{goal.target_count}
            </span>
          )}
        </button>
      </form>
    )
  }

  // Buddy's goal — read only with reaction
  return (
    <div className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 ${
      done ? 'text-white' : 'bg-gray-50 text-gray-500'
    }`}
      style={done ? { background: 'linear-gradient(135deg, #00C9A7, #0077B6)' } : {}}
    >
      <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
        done ? 'border-white bg-white/30' : 'border-gray-300'
      }`}>
        {done && <span className="text-white text-xs font-bold">✓</span>}
      </span>
      <span className="text-sm font-semibold flex-1">{goal.title}</span>
      {done && checkIn && (
        <ReactionPicker checkInId={checkIn.id} existingEmoji={reaction?.emoji} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create components/dashboard/DashboardClient.tsx**

This is the client component that subscribes to real-time updates and re-renders the dashboard.

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import GoalCard from './GoalCard'
import type { Goal, CheckIn, Reaction, ChallengeWithProfiles, Profile } from '@/types/database'

interface Props {
  challenge: ChallengeWithProfiles
  myGoals: Goal[]
  buddyGoals: Goal[]
  myCheckIns: CheckIn[]
  buddyCheckIns: CheckIn[]
  reactions: Reaction[]
  myId: string
  today: string
  dayNumber: number
  totalDays: number
}

export default function DashboardClient({
  challenge,
  myGoals,
  buddyGoals,
  myCheckIns,
  buddyCheckIns,
  reactions,
  myId,
  today,
  dayNumber,
  totalDays,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const buddy = (challenge.creator_id === myId ? challenge.buddy : challenge.creator) as Profile | null

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'check_ins',
      }, () => router.refresh())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reactions',
      }, () => router.refresh())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  function getCheckIn(goalId: string, checkIns: CheckIn[]) {
    return checkIns.find(c => c.goal_id === goalId && c.date === today) ?? null
  }

  function getReaction(checkInId: string | undefined) {
    if (!checkInId) return null
    return reactions.find(r => r.check_in_id === checkInId) ?? null
  }

  const myDone = myGoals.filter(g => getCheckIn(g.id, myCheckIns)).length
  const buddyDone = buddyGoals.filter(g => getCheckIn(g.id, buddyCheckIns)).length

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div
        className="rounded-2xl p-6 mb-6 text-white"
        style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
      >
        <p className="text-white/70 text-sm font-semibold uppercase tracking-wide">
          {challenge.month_name}
        </p>
        <h1 className="text-3xl font-black mt-1">Day {dayNumber} of {totalDays}</h1>
        <p className="text-white/60 text-sm mt-1">
          {new Date(today).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Side by side columns */}
      <div className="grid grid-cols-2 gap-4">
        {/* My column */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="font-black text-gray-900">You</span>
            <span
              className="text-xs font-bold px-3 py-1 rounded-full text-white"
              style={{ background: '#F9F871', color: '#0077B6' }}
            >
              {myDone}/{myGoals.length} today
            </span>
          </div>
          <div className="space-y-2">
            {myGoals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                checkIn={getCheckIn(goal.id, myCheckIns)}
                reaction={null}
                isMyGoal={true}
                today={today}
              />
            ))}
          </div>
        </div>

        {/* Buddy column */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="font-black text-gray-900">{buddy?.name ?? 'Buddy'}</span>
            <span
              className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: '#E8FBF7', color: '#00C9A7' }}
            >
              {buddyDone}/{buddyGoals.length} today
            </span>
          </div>
          <div className="space-y-2">
            {buddyGoals.map(goal => {
              const checkIn = getCheckIn(goal.id, buddyCheckIns)
              return (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  checkIn={checkIn}
                  reaction={getReaction(checkIn?.id)}
                  isMyGoal={false}
                  today={today}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Update app/dashboard/page.tsx to render active challenge**

Replace the `// Active challenge — show full dashboard` comment block with:

```tsx
  // Active challenge — fetch goals and check-ins, render full dashboard
  const today = new Date().toISOString().split('T')[0]

  const start = new Date(typedChallenge.start_date)
  const todayDate = new Date(today)
  const dayNumber = Math.max(1, Math.floor((todayDate.getTime() - start.getTime()) / 86400000) + 1)
  const totalDays = Math.floor(
    (new Date(typedChallenge.end_date).getTime() - start.getTime()) / 86400000
  ) + 1

  const buddyId = typedChallenge.creator_id === user.id
    ? typedChallenge.buddy_id
    : typedChallenge.creator_id

  const [goalsRes, myCheckInsRes, buddyCheckInsRes, reactionsRes] = await Promise.all([
    supabase.from('goals').select('*').eq('challenge_id', typedChallenge.id),
    supabase.from('check_ins').select('*')
      .eq('user_id', user.id)
      .gte('date', typedChallenge.start_date)
      .lte('date', typedChallenge.end_date),
    supabase.from('check_ins').select('*')
      .eq('user_id', buddyId!)
      .gte('date', typedChallenge.start_date)
      .lte('date', typedChallenge.end_date),
    supabase.from('reactions').select('*'),
  ])

  const allGoals = goalsRes.data ?? []
  const myGoals = allGoals.filter(g => g.user_id === user.id)
  const buddyGoals = allGoals.filter(g => g.user_id === buddyId)

  return (
    <DashboardClient
      challenge={typedChallenge}
      myGoals={myGoals}
      buddyGoals={buddyGoals}
      myCheckIns={myCheckInsRes.data ?? []}
      buddyCheckIns={buddyCheckInsRes.data ?? []}
      reactions={reactionsRes.data ?? []}
      myId={user.id}
      today={today}
      dayNumber={dayNumber}
      totalDays={totalDays}
    />
  )
```

Also add `import DashboardClient from '@/components/dashboard/DashboardClient'` at the top of the file.

- [ ] **Step 6: Test full dashboard flow**

With both users set up and challenge active: log in as user 1, tick some goals on the dashboard. Log in as user 2 in another browser, see user 1's goals update in real time. React with an emoji.

- [ ] **Step 7: Commit**

```
git add components/dashboard/ app/dashboard/
git commit -m "feat: active dashboard with check-ins, real-time, and reactions"
```

---

## Task 12: Scoring Logic (TDD)

**Files:**
- Create: `lib/scoring.ts`
- Create: `lib/__tests__/scoring.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `lib/__tests__/scoring.test.ts`:

```ts
import { scoreGoal, scoreChallenge } from '../scoring'
import type { Goal, CheckIn } from '@/types/database'

const baseGoal = (type: Goal['type'], target_count: number | null = null): Goal => ({
  id: 'g1', challenge_id: 'c1', user_id: 'u1',
  title: 'Test', type, target_count, created_at: '',
})

describe('scoreGoal', () => {
  it('scores a daily goal as completed/total days', () => {
    const goal = baseGoal('daily')
    const checkIns: CheckIn[] = [
      { id: '1', goal_id: 'g1', user_id: 'u1', date: '2026-05-01', completed: true, created_at: '' },
      { id: '2', goal_id: 'g1', user_id: 'u1', date: '2026-05-02', completed: true, created_at: '' },
    ]
    expect(scoreGoal(goal, checkIns, 10)).toBeCloseTo(0.2)
  })

  it('scores a milestone goal as 1 if completed, 0 otherwise', () => {
    const goal = baseGoal('milestone')
    const withCheckIn: CheckIn[] = [
      { id: '1', goal_id: 'g1', user_id: 'u1', date: '2026-05-01', completed: true, created_at: '' },
    ]
    expect(scoreGoal(goal, withCheckIn, 30)).toBe(1)
    expect(scoreGoal(goal, [], 30)).toBe(0)
  })

  it('scores a frequency goal as completions/target, capped at 1', () => {
    const goal = baseGoal('frequency', 10)
    const checkIns: CheckIn[] = Array.from({ length: 7 }, (_, i) => ({
      id: String(i), goal_id: 'g1', user_id: 'u1',
      date: `2026-05-0${i + 1}`, completed: true, created_at: '',
    }))
    expect(scoreGoal(goal, checkIns, 30)).toBeCloseTo(0.7)
  })

  it('caps frequency goal score at 1 when over target', () => {
    const goal = baseGoal('frequency', 5)
    const checkIns: CheckIn[] = Array.from({ length: 8 }, (_, i) => ({
      id: String(i), goal_id: 'g1', user_id: 'u1',
      date: `2026-05-0${i + 1}`, completed: true, created_at: '',
    }))
    expect(scoreGoal(goal, checkIns, 30)).toBe(1)
  })
})

describe('scoreChallenge', () => {
  it('returns average of goal scores as a percentage', () => {
    const goals: Goal[] = [
      baseGoal('milestone'),
      baseGoal('milestone'),
    ]
    const checkIns: CheckIn[] = [
      { id: '1', goal_id: 'g1', user_id: 'u1', date: '2026-05-01', completed: true, created_at: '' },
    ]
    // First goal completed (1.0), second not (0.0) → average 50%
    expect(scoreChallenge(goals, checkIns, 30)).toBe(50)
  })

  it('returns 0 when no goals', () => {
    expect(scoreChallenge([], [], 30)).toBe(0)
  })
})
```

- [ ] **Step 2: Run to confirm tests fail**

```
npm test -- lib/__tests__/scoring.test.ts
```

Expected: FAIL — `scoreGoal` and `scoreChallenge` not found.

- [ ] **Step 3: Implement lib/scoring.ts**

```ts
import type { Goal, CheckIn } from '@/types/database'

export function scoreGoal(goal: Goal, checkIns: CheckIn[], totalDays: number): number {
  const relevant = checkIns.filter(c => c.goal_id === goal.id && c.completed)

  if (goal.type === 'daily') {
    return totalDays === 0 ? 0 : relevant.length / totalDays
  }

  if (goal.type === 'milestone') {
    return relevant.length > 0 ? 1 : 0
  }

  // frequency
  const target = goal.target_count ?? 1
  return Math.min(1, relevant.length / target)
}

export function scoreChallenge(goals: Goal[], checkIns: CheckIn[], totalDays: number): number {
  if (goals.length === 0) return 0
  const total = goals.reduce((sum, g) => sum + scoreGoal(g, checkIns, totalDays), 0)
  return Math.round((total / goals.length) * 100)
}
```

- [ ] **Step 4: Run to confirm tests pass**

```
npm test -- lib/__tests__/scoring.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```
git add lib/scoring.ts lib/__tests__/
git commit -m "feat: goal scoring logic with tests"
```

---

## Task 13: Monthly Progress View

**Files:**
- Create: `components/month/ProgressView.tsx`
- Create: `components/month/GoalDrillDown.tsx`
- Create: `app/month/page.tsx`

- [ ] **Step 1: Create components/month/GoalDrillDown.tsx**

```tsx
'use client'

import { useState } from 'react'
import type { Goal, CheckIn } from '@/types/database'

interface Props {
  goal: Goal
  checkIns: CheckIn[]
  startDate: string
  endDate: string
  today: string
}

export default function GoalDrillDown({ goal, checkIns, startDate, endDate, today }: Props) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const days: string[] = []

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().split('T')[0])
  }

  function statusForDay(date: string) {
    if (date > today) return 'future'
    const hit = checkIns.some(c => c.goal_id === goal.id && c.date === date && c.completed)
    return hit ? 'done' : 'missed'
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
        Daily breakdown
      </p>
      <div className="grid grid-cols-7 gap-1">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="text-center text-xs font-bold text-gray-300">{d}</div>
        ))}
        {/* Fill empty cells for first week */}
        {Array.from({ length: (new Date(startDate).getDay() + 6) % 7 }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {days.map(date => {
          const status = statusForDay(date)
          const isToday = date === today
          return (
            <div
              key={date}
              className="aspect-square rounded flex items-center justify-center text-xs font-bold"
              style={{
                background: isToday
                  ? '#F9F871'
                  : status === 'done'
                  ? '#00C9A7'
                  : status === 'missed'
                  ? '#f0f0f0'
                  : 'transparent',
                color: isToday ? '#0077B6' : status === 'done' ? 'white' : '#ccc',
              }}
            >
              {new Date(date).getDate()}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create components/month/ProgressView.tsx**

```tsx
'use client'

import { useState } from 'react'
import GoalDrillDown from './GoalDrillDown'
import { scoreChallenge, scoreGoal } from '@/lib/scoring'
import type { Goal, CheckIn, Profile } from '@/types/database'

interface Props {
  myGoals: Goal[]
  buddyGoals: Goal[]
  myCheckIns: CheckIn[]
  buddyCheckIns: CheckIn[]
  myProfile: Profile
  buddyProfile: Profile | null
  startDate: string
  endDate: string
  today: string
  totalDays: number
}

export default function ProgressView({
  myGoals, buddyGoals, myCheckIns, buddyCheckIns,
  myProfile, buddyProfile, startDate, endDate, today, totalDays,
}: Props) {
  const [activeTab, setActiveTab] = useState<'me' | 'buddy'>('me')
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null)

  const myScore = scoreChallenge(myGoals, myCheckIns, totalDays)
  const buddyScore = scoreChallenge(buddyGoals, buddyCheckIns, totalDays)

  const goals = activeTab === 'me' ? myGoals : buddyGoals
  const checkIns = activeTab === 'me' ? myCheckIns : buddyCheckIns

  const daysElapsed = Math.min(
    totalDays,
    Math.max(0, Math.floor((new Date(today).getTime() - new Date(startDate).getTime()) / 86400000) + 1)
  )

  function goalLabel(goal: Goal, checkIns: CheckIn[]) {
    const relevant = checkIns.filter(c => c.goal_id === goal.id && c.completed)
    if (goal.type === 'daily') return `${relevant.length}/${daysElapsed} days`
    if (goal.type === 'milestone') return relevant.length > 0 ? 'Done ✓' : 'Not yet'
    return `${relevant.length}/${goal.target_count} times`
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-black text-gray-900 mb-6">Monthly Progress</h1>

      {/* Overall scores */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {[
          { profile: myProfile, score: myScore, checkIns: myCheckIns, goals: myGoals },
          { profile: buddyProfile, score: buddyScore, checkIns: buddyCheckIns, goals: buddyGoals },
        ].map(({ profile, score }) => (
          <div key={profile?.id ?? 'buddy'} className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-sm font-bold text-gray-500 mb-1">{profile?.name ?? 'Buddy'}</p>
            <p className="text-4xl font-black" style={{ color: '#0077B6' }}>{score}%</p>
            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${score}%`,
                  background: 'linear-gradient(90deg, #00C9A7, #0077B6)',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Tab toggle */}
      <div className="flex border-b border-gray-200 mb-4">
        {(['me', 'buddy'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setExpandedGoal(null) }}
            className={`flex-1 py-2 text-sm font-bold transition ${
              activeTab === tab ? 'text-teal-600 border-b-2 border-teal-500' : 'text-gray-400'
            }`}
          >
            {tab === 'me' ? myProfile.name : (buddyProfile?.name ?? 'Buddy')}
          </button>
        ))}
      </div>

      {/* Per-goal rows */}
      <div className="space-y-2">
        {goals.map(goal => {
          const pct = Math.round(scoreGoal(goal, checkIns, totalDays) * 100)
          const isExpanded = expandedGoal === goal.id
          return (
            <div
              key={goal.id}
              className="bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:border-teal-200 transition"
              onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-800">{goal.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{goalLabel(goal, checkIns)}</p>
                </div>
                <span className="text-sm font-black" style={{ color: '#0077B6' }}>{pct}%</span>
                <span className="text-gray-300 text-xs">{isExpanded ? '▲' : '▼'}</span>
              </div>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #00C9A7, #0077B6)' }}
                />
              </div>
              {isExpanded && (
                <GoalDrillDown
                  goal={goal}
                  checkIns={checkIns}
                  startDate={startDate}
                  endDate={endDate}
                  today={today}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create app/month/page.tsx**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProgressView from '@/components/month/ProgressView'
import type { ChallengeWithProfiles, Profile } from '@/types/database'

export default async function MonthPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: challenge } = await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .in('status', ['active', 'completed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!challenge) redirect('/dashboard')

  const typedChallenge = challenge as unknown as ChallengeWithProfiles
  const today = new Date().toISOString().split('T')[0]

  const start = new Date(typedChallenge.start_date)
  const totalDays = Math.floor(
    (new Date(typedChallenge.end_date).getTime() - start.getTime()) / 86400000
  ) + 1

  const buddyId = typedChallenge.creator_id === user.id
    ? typedChallenge.buddy_id
    : typedChallenge.creator_id

  const [goalsRes, myCheckInsRes, buddyCheckInsRes, myProfileRes] = await Promise.all([
    supabase.from('goals').select('*').eq('challenge_id', typedChallenge.id),
    supabase.from('check_ins').select('*').eq('user_id', user.id),
    supabase.from('check_ins').select('*').eq('user_id', buddyId!),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
  ])

  const allGoals = goalsRes.data ?? []
  const myGoals = allGoals.filter(g => g.user_id === user.id)
  const buddyGoals = allGoals.filter(g => g.user_id === buddyId)
  const buddyProfile = (typedChallenge.creator_id === user.id
    ? typedChallenge.buddy
    : typedChallenge.creator) as Profile | null

  return (
    <ProgressView
      myGoals={myGoals}
      buddyGoals={buddyGoals}
      myCheckIns={myCheckInsRes.data ?? []}
      buddyCheckIns={buddyCheckInsRes.data ?? []}
      myProfile={myProfileRes.data!}
      buddyProfile={buddyProfile}
      startDate={typedChallenge.start_date}
      endDate={typedChallenge.end_date}
      today={today}
      totalDays={totalDays}
    />
  )
}
```

- [ ] **Step 4: Commit**

```
git add components/month/ app/month/
git commit -m "feat: monthly progress view with drill-down"
```

---

## Task 14: Wrap-Up Screen

**Files:**
- Create: `components/wrap-up/ScoreSummary.tsx`
- Create: `app/wrap-up/page.tsx`

- [ ] **Step 1: Create components/wrap-up/ScoreSummary.tsx**

```tsx
import type { Goal, CheckIn, Profile } from '@/types/database'
import { scoreChallenge, scoreGoal } from '@/lib/scoring'
import Link from 'next/link'

interface Props {
  myGoals: Goal[]
  buddyGoals: Goal[]
  myCheckIns: CheckIn[]
  buddyCheckIns: CheckIn[]
  myProfile: Profile
  buddyProfile: Profile | null
  totalDays: number
  challengeName: string
  isComplete: boolean
}

export default function ScoreSummary({
  myGoals, buddyGoals, myCheckIns, buddyCheckIns,
  myProfile, buddyProfile, totalDays, challengeName, isComplete,
}: Props) {
  const myScore = scoreChallenge(myGoals, myCheckIns, totalDays)
  const buddyScore = scoreChallenge(buddyGoals, buddyCheckIns, totalDays)
  const iWon = myScore > buddyScore
  const tied = myScore === buddyScore

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div
        className="rounded-2xl p-6 text-white mb-8"
        style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
      >
        <p className="text-white/70 text-sm font-semibold uppercase tracking-wide">
          {isComplete ? 'Final Results' : 'Week in Review'}
        </p>
        <h1 className="text-3xl font-black mt-1">{challengeName}</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {[
          { profile: myProfile, score: myScore, isWinner: !tied && iWon },
          { profile: buddyProfile, score: buddyScore, isWinner: !tied && !iWon },
        ].map(({ profile, score, isWinner }) => (
          <div
            key={profile?.id ?? 'buddy'}
            className="rounded-2xl border-2 p-5 text-center"
            style={{
              borderColor: isWinner ? '#F9F871' : '#e5e7eb',
              background: isWinner ? '#fffde7' : 'white',
            }}
          >
            {isWinner && <p className="text-xs font-black text-yellow-600 mb-1">🏆 WINNER</p>}
            <p className="text-sm font-bold text-gray-500">{profile?.name ?? 'Buddy'}</p>
            <p className="text-5xl font-black mt-2" style={{ color: '#0077B6' }}>{score}%</p>
          </div>
        ))}
      </div>

      {tied && (
        <p className="text-center text-gray-500 text-sm mb-6 font-semibold">It's a tie! 🤝</p>
      )}

      {/* Per-goal breakdown */}
      <h2 className="font-black text-gray-900 mb-3">Your goals this period</h2>
      <div className="space-y-2 mb-8">
        {myGoals.map(goal => {
          const pct = Math.round(scoreGoal(goal, myCheckIns, totalDays) * 100)
          return (
            <div key={goal.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">{goal.title}</p>
              </div>
              <div className="text-sm font-black" style={{ color: pct >= 80 ? '#00C9A7' : pct >= 50 ? '#0077B6' : '#ef4444' }}>
                {pct}%
              </div>
            </div>
          )
        })}
      </div>

      {isComplete && (
        <Link
          href="/dashboard"
          className="block w-full text-center py-3 rounded-xl font-bold text-sm"
          style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)', color: 'white' }}
        >
          Start a new challenge →
        </Link>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create app/wrap-up/page.tsx**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ScoreSummary from '@/components/wrap-up/ScoreSummary'
import type { ChallengeWithProfiles, Profile } from '@/types/database'

export default async function WrapUpPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: challenge } = await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .in('status', ['active', 'completed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!challenge) redirect('/dashboard')

  const typedChallenge = challenge as unknown as ChallengeWithProfiles
  const buddyId = typedChallenge.creator_id === user.id
    ? typedChallenge.buddy_id
    : typedChallenge.creator_id

  const totalDays = Math.floor(
    (new Date(typedChallenge.end_date).getTime() - new Date(typedChallenge.start_date).getTime()) / 86400000
  ) + 1

  const [goalsRes, myCheckInsRes, buddyCheckInsRes, myProfileRes] = await Promise.all([
    supabase.from('goals').select('*').eq('challenge_id', typedChallenge.id),
    supabase.from('check_ins').select('*').eq('user_id', user.id),
    supabase.from('check_ins').select('*').eq('user_id', buddyId!),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
  ])

  const allGoals = goalsRes.data ?? []
  const buddyProfile = (typedChallenge.creator_id === user.id
    ? typedChallenge.buddy
    : typedChallenge.creator) as Profile | null

  return (
    <ScoreSummary
      myGoals={allGoals.filter(g => g.user_id === user.id)}
      buddyGoals={allGoals.filter(g => g.user_id === buddyId)}
      myCheckIns={myCheckInsRes.data ?? []}
      buddyCheckIns={buddyCheckInsRes.data ?? []}
      myProfile={myProfileRes.data!}
      buddyProfile={buddyProfile}
      totalDays={totalDays}
      challengeName={typedChallenge.month_name}
      isComplete={typedChallenge.status === 'completed'}
    />
  )
}
```

- [ ] **Step 3: Commit**

```
git add components/wrap-up/ app/wrap-up/
git commit -m "feat: wrap-up screen with scoring"
```

---

## Task 15: Email Notifications (Resend)

**Files:**
- Create: `lib/email.ts`
- Create: `app/api/cron/weekly/route.ts`
- Create: `app/api/cron/monthly/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Sign up for Resend**

Go to resend.com, create a free account. In the dashboard → API Keys → Create new key. Copy the key. Add to `.env.local`:

```
RESEND_API_KEY=re_xxxxxxxx
CRON_SECRET=<make up a random string, e.g. my-secret-123>
```

Also add both to Vercel environment variables (Settings → Environment Variables).

- [ ] **Step 2: Create lib/email.ts**

```ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface WeeklyEmailData {
  toEmail: string
  toName: string
  buddyName: string
  myScore: number
  buddyScore: number
  weekStart: string
  weekEnd: string
  challengeName: string
}

export async function sendWeeklyWrapUp(data: WeeklyEmailData) {
  const { toEmail, toName, buddyName, myScore, buddyScore, weekStart, weekEnd, challengeName } = data

  await resend.emails.send({
    from: 'Accountabilibuddies <noreply@yourdomain.com>',
    to: toEmail,
    subject: `${challengeName} — Week in Review`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h1 style="font-size:24px;font-weight:900;color:#0077B6">Week in Review 🎯</h1>
        <p style="color:#666">Hi ${toName}, here's how you and ${buddyName} did this week.</p>
        <div style="display:flex;gap:16px;margin:24px 0">
          <div style="flex:1;background:#E8FBF7;border-radius:12px;padding:16px;text-align:center">
            <p style="font-size:12px;color:#666;margin:0">You</p>
            <p style="font-size:36px;font-weight:900;color:#0077B6;margin:4px 0">${myScore}%</p>
          </div>
          <div style="flex:1;background:#f5f5f5;border-radius:12px;padding:16px;text-align:center">
            <p style="font-size:12px;color:#666;margin:0">${buddyName}</p>
            <p style="font-size:36px;font-weight:900;color:#0077B6;margin:4px 0">${buddyScore}%</p>
          </div>
        </div>
        <p style="color:#666;font-size:14px">
          ${myScore > buddyScore ? "You're ahead this week! Keep it up 💪" :
            myScore < buddyScore ? `${buddyName} is ahead — time to catch up! 🔥` :
            "You're neck and neck! 🤝"}
        </p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/wrap-up"
          style="display:block;background:linear-gradient(135deg,#00C9A7,#0077B6);color:white;text-align:center;padding:12px;border-radius:12px;font-weight:700;text-decoration:none;margin-top:24px">
          View full summary →
        </a>
      </div>
    `,
  })
}

interface MonthlyEmailData {
  toEmail: string
  toName: string
  buddyName: string
  myScore: number
  buddyScore: number
  challengeName: string
  won: boolean
  tied: boolean
}

export async function sendMonthlyWrapUp(data: MonthlyEmailData) {
  const { toEmail, toName, buddyName, myScore, buddyScore, challengeName, won, tied } = data

  await resend.emails.send({
    from: 'Accountabilibuddies <noreply@yourdomain.com>',
    to: toEmail,
    subject: `${challengeName} — Final Results 🏆`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h1 style="font-size:24px;font-weight:900;color:#0077B6">Challenge Complete! 🎉</h1>
        <p style="color:#666">The ${challengeName} is over. Here are the final results.</p>
        <div style="display:flex;gap:16px;margin:24px 0">
          <div style="flex:1;background:${won || tied ? '#fffde7' : '#f5f5f5'};border:2px solid ${won ? '#F9F871' : '#e5e7eb'};border-radius:12px;padding:16px;text-align:center">
            ${won ? '<p style="font-size:11px;font-weight:900;color:#d97706;margin:0">🏆 WINNER</p>' : ''}
            <p style="font-size:12px;color:#666;margin:0">You</p>
            <p style="font-size:36px;font-weight:900;color:#0077B6;margin:4px 0">${myScore}%</p>
          </div>
          <div style="flex:1;background:${!won && !tied ? '#fffde7' : '#f5f5f5'};border:2px solid ${!won && !tied ? '#F9F871' : '#e5e7eb'};border-radius:12px;padding:16px;text-align:center">
            ${!won && !tied ? '<p style="font-size:11px;font-weight:900;color:#d97706;margin:0">🏆 WINNER</p>' : ''}
            <p style="font-size:12px;color:#666;margin:0">${buddyName}</p>
            <p style="font-size:36px;font-weight:900;color:#0077B6;margin:4px 0">${buddyScore}%</p>
          </div>
        </div>
        ${tied ? '<p style="text-align:center;color:#666">It\'s a tie! Great work both of you 🤝</p>' : ''}
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard"
          style="display:block;background:linear-gradient(135deg,#00C9A7,#0077B6);color:white;text-align:center;padding:12px;border-radius:12px;font-weight:700;text-decoration:none;margin-top:24px">
          Start a new challenge →
        </a>
      </div>
    `,
  })
}
```

- [ ] **Step 3: Create app/api/cron/weekly/route.ts**

```ts
import { createClient } from '@supabase/supabase-js'
import { sendWeeklyWrapUp } from '@/lib/email'
import { scoreChallenge } from '@/lib/scoring'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // Get all active challenges
  const { data: challenges } = await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
    .eq('status', 'active')

  if (!challenges) return NextResponse.json({ sent: 0 })

  let sent = 0

  for (const challenge of challenges) {
    const buddyId = challenge.buddy_id
    if (!buddyId) continue

    const [goalsRes, creatorCheckInsRes, buddyCheckInsRes, creatorAuthRes, buddyAuthRes] =
      await Promise.all([
        supabase.from('goals').select('*').eq('challenge_id', challenge.id),
        supabase.from('check_ins').select('*').eq('user_id', challenge.creator_id),
        supabase.from('check_ins').select('*').eq('user_id', buddyId),
        supabase.auth.admin.getUserById(challenge.creator_id),
        supabase.auth.admin.getUserById(buddyId),
      ])

    const allGoals = goalsRes.data ?? []
    const creatorGoals = allGoals.filter(g => g.user_id === challenge.creator_id)
    const buddyGoals = allGoals.filter(g => g.user_id === buddyId)
    const totalDays = Math.floor(
      (new Date(challenge.end_date).getTime() - new Date(challenge.start_date).getTime()) / 86400000
    ) + 1

    const creatorScore = scoreChallenge(creatorGoals, creatorCheckInsRes.data ?? [], totalDays)
    const buddyScore = scoreChallenge(buddyGoals, buddyCheckInsRes.data ?? [], totalDays)

    const weekStart = new Date(today); weekStart.setDate(today.getDate() - 6)
    const weekStartStr = weekStart.toISOString().split('T')[0]

    const creatorEmail = creatorAuthRes.data.user?.email
    const buddyEmail = buddyAuthRes.data.user?.email
    const creatorName = (challenge.creator as any)?.name ?? 'Friend'
    const buddyName = (challenge.buddy as any)?.name ?? 'Friend'

    if (creatorEmail) {
      await sendWeeklyWrapUp({
        toEmail: creatorEmail, toName: creatorName, buddyName,
        myScore: creatorScore, buddyScore, weekStart: weekStartStr,
        weekEnd: todayStr, challengeName: challenge.month_name,
      })
      sent++
    }

    if (buddyEmail) {
      await sendWeeklyWrapUp({
        toEmail: buddyEmail, toName: buddyName, buddyName: creatorName,
        myScore: buddyScore, buddyScore: creatorScore, weekStart: weekStartStr,
        weekEnd: todayStr, challengeName: challenge.month_name,
      })
      sent++
    }
  }

  return NextResponse.json({ sent })
}
```

- [ ] **Step 4: Create app/api/cron/monthly/route.ts**

```ts
import { createClient } from '@supabase/supabase-js'
import { sendMonthlyWrapUp } from '@/lib/email'
import { scoreChallenge } from '@/lib/scoring'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date().toISOString().split('T')[0]

  // Find challenges ending today — mark them complete
  const { data: challenges } = await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
    .eq('status', 'active')
    .eq('end_date', today)

  if (!challenges) return NextResponse.json({ sent: 0 })

  let sent = 0

  for (const challenge of challenges) {
    await supabase
      .from('challenge_months')
      .update({ status: 'completed' })
      .eq('id', challenge.id)

    const buddyId = challenge.buddy_id
    if (!buddyId) continue

    const [goalsRes, creatorCheckInsRes, buddyCheckInsRes, creatorAuthRes, buddyAuthRes] =
      await Promise.all([
        supabase.from('goals').select('*').eq('challenge_id', challenge.id),
        supabase.from('check_ins').select('*').eq('user_id', challenge.creator_id),
        supabase.from('check_ins').select('*').eq('user_id', buddyId),
        supabase.auth.admin.getUserById(challenge.creator_id),
        supabase.auth.admin.getUserById(buddyId),
      ])

    const allGoals = goalsRes.data ?? []
    const creatorGoals = allGoals.filter(g => g.user_id === challenge.creator_id)
    const buddyGoals = allGoals.filter(g => g.user_id === buddyId)
    const totalDays = Math.floor(
      (new Date(challenge.end_date).getTime() - new Date(challenge.start_date).getTime()) / 86400000
    ) + 1

    const creatorScore = scoreChallenge(creatorGoals, creatorCheckInsRes.data ?? [], totalDays)
    const buddyScore = scoreChallenge(buddyGoals, buddyCheckInsRes.data ?? [], totalDays)
    const creatorWon = creatorScore > buddyScore
    const tied = creatorScore === buddyScore

    const creatorEmail = creatorAuthRes.data.user?.email
    const buddyEmail = buddyAuthRes.data.user?.email
    const creatorName = (challenge.creator as any)?.name ?? 'Friend'
    const buddyName = (challenge.buddy as any)?.name ?? 'Friend'

    if (creatorEmail) {
      await sendMonthlyWrapUp({
        toEmail: creatorEmail, toName: creatorName, buddyName,
        myScore: creatorScore, buddyScore, challengeName: challenge.month_name,
        won: creatorWon, tied,
      })
      sent++
    }

    if (buddyEmail) {
      await sendMonthlyWrapUp({
        toEmail: buddyEmail, toName: buddyName, buddyName: creatorName,
        myScore: buddyScore, buddyScore: creatorScore, challengeName: challenge.month_name,
        won: !creatorWon && !tied, tied,
      })
      sent++
    }
  }

  return NextResponse.json({ sent })
}
```

- [ ] **Step 5: Add SUPABASE_SERVICE_ROLE_KEY to .env.local**

In Supabase → Settings → API, copy the `service_role` key (under "Project API keys"). Add to `.env.local`:

```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Also add to Vercel environment variables.

- [ ] **Step 6: Create vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/cron/weekly",
      "schedule": "0 9 * * 0"
    },
    {
      "path": "/api/cron/monthly",
      "schedule": "0 9 * * *"
    }
  ]
}
```

- [ ] **Step 7: Update email sender domain**

In `lib/email.ts`, replace `noreply@yourdomain.com` with an email address on a domain you own (or use Resend's free sandbox domain `onboarding@resend.dev` for testing).

- [ ] **Step 8: Commit**

```
git add lib/email.ts app/api/cron/ vercel.json .env.local
git commit -m "feat: email notifications via Resend with Vercel cron jobs"
```

---

## Task 16: Deploy and Smoke Test

- [ ] **Step 1: Push all changes to GitHub**

```
git push origin main
```

Expected: Vercel auto-deploys within 2 minutes.

- [ ] **Step 2: Add env vars to Vercel if not already done**

In Vercel → Settings → Environment Variables, confirm these are all set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL` (set to your Vercel URL, e.g. `https://accountabilibuddies.vercel.app`)
- `RESEND_API_KEY`
- `CRON_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

- [ ] **Step 3: Redeploy after adding env vars**

In Vercel → Deployments → click the latest deployment → Redeploy.

- [ ] **Step 4: Full end-to-end smoke test**

On the live URL:
1. Sign up as User A → create a challenge → add 5+ goals → copy invite link
2. Open invite link in incognito → sign up as User B → add 5+ goals
3. Log back in as User A → dashboard should show both columns
4. Tick 2-3 goals → switch to User B's session → see User A's goals update in real time
5. React to a goal with an emoji
6. Visit `/month` — confirm progress bars and drill-down work
7. Visit `/wrap-up` — confirm scores show

- [ ] **Step 5: Final commit**

```
git add -A
git commit -m "feat: complete accountabilibuddies MVP"
git push origin main
```

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| Auth (sign up, log in, log out) | Tasks 4, 6 |
| Create challenge + invite link | Task 8 |
| Join via invite link | Task 10 |
| Goal setup (daily, milestone, frequency) | Task 9 |
| Daily dashboard, side by side | Task 11 |
| Goal logging (toggle check-in) | Task 11 |
| Real-time buddy column | Task 11 |
| Reactions on buddy check-ins | Task 11 |
| Monthly progress view with progress bars | Task 13 |
| Per-goal drill-down calendar | Task 13 |
| Scoring logic | Task 12 |
| Wrap-up screen with winner highlight | Task 14 |
| Sunday wrap-up email | Task 15 |
| End of month email + status update | Task 15 |
| Vercel cron schedule | Task 15 |
| Visual design (teal/blue/yellow) | Tasks 5, 6, 7+ |
