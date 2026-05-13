# What can an AI agent do in this project?

A walkthrough of how an AI coding agent (Claude, Copilot, etc.) running in
this codebase authenticates to GitHub, Supabase, and Vercel — and what it
can and cannot do.

The agent has access to two things:

1. **Read/write access to the project folder** on your computer.
2. **Permission to run shell commands** like `git`, `node`, `npm`.

Everything below follows from those two permissions.

---

## 1. GitHub — uses your computer's saved login

```bash
$ git remote -v
origin  https://github.com/iamdylan1234/accountabilibuddies.git (fetch)
origin  https://github.com/iamdylan1234/accountabilibuddies.git (push)

$ git config --get credential.helper
manager
```

**What this means:** Your computer remembers your GitHub login (same way
your browser remembers passwords). The setting `credential.helper = manager`
means "use Windows Credential Manager" (the OS-level password store).

When the agent runs `git push`, it doesn't know your GitHub password.
Windows hands the saved password directly to GitHub. The agent is just
the messenger asking for the push to happen.

**How to revoke:** open Windows → Settings → Credential Manager → Windows
Credentials → find `git:https://github.com` → remove it. Or rotate your
GitHub password / personal access token. The agent would be locked out
of pushes immediately.

---

## 2. Supabase — admin key stored on disk

```bash
$ ls -la .env.local
-rw-r--r-- 1 Admin 197121 353 May  1 12:54 .env.local

$ grep -E "^[A-Z_]+" .env.local | sed 's/=.*/=<redacted>/'
NEXT_PUBLIC_SUPABASE_URL=<redacted>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<redacted>
RESEND_API_KEY=<redacted>
NEXT_PUBLIC_APP_URL=<redacted>
CRON_SECRET=<redacted>
SUPABASE_SERVICE_ROLE_KEY=<redacted>
```

**What this means:** The project has a hidden file `.env.local` (gitignored,
never committed to GitHub) that holds API keys for various services. The
agent can read this file because it's on disk and the agent has read
access to the project folder.

The important one is `SUPABASE_SERVICE_ROLE_KEY` — an **admin-level key**
that bypasses Supabase's Row-Level Security. Scripts like
`scripts/seed-test-users.mjs` and `scripts/usage-stats.mjs` use this key
to read every user, count check-ins, delete test users, etc.

`.env.local` is in the `.gitignore`, so it's never sent to GitHub:

```bash
$ grep ".env" .gitignore
.env*.local
```

The keys ALSO live in Vercel's environment variable settings (so the
deployed app can use them) — but the agent doesn't have access to Vercel's
dashboard either way.

**How to revoke:** rotate the service role key in Supabase
(Settings → API → Reset service_role key), then update `.env.local` on
your machine and Vercel's env vars. The agent's scripts would
immediately fail with "invalid key" errors.

**Important honesty point:** the agent could also use:
- `RESEND_API_KEY` to send emails as you (it hasn't)
- `CRON_SECRET` to call your cron endpoints
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` to interact with Supabase as a
  regular user (less powerful than service role)

All of these are in the same `.env.local` file. Read access to the
folder = access to all of them.

---

## 3. Vercel — the agent has NO direct access

```bash
$ ls -la .vercel
ls: cannot access '.vercel': No such file or directory

$ which vercel
(no output — Vercel CLI is not installed)
```

**What this means:** The agent cannot talk to Vercel directly. There's no
Vercel CLI installed, no API token, no `.vercel` folder.

Every time the agent says *"Vercel will redeploy now,"* what actually
happens is:

1. The agent runs `git push` to GitHub.
2. **Vercel watches the GitHub repository** (you configured this once
   when you connected the project to Vercel).
3. When a new commit lands on the `main` branch, Vercel detects it via
   a webhook from GitHub and deploys automatically.
4. The agent never touches Vercel — the deploy happens entirely between
   GitHub and Vercel.

**This means the agent has a blind spot:** if a deploy fails on Vercel
(missing env var, build error, runtime crash), the agent won't know
unless you tell it. The agent doesn't read build logs and can't roll
back deploys.

**If you wanted the agent to actually check deploy status**, you'd need
to install the Vercel CLI and log in, or give the agent a Vercel API
token. Right now there's intentionally no such access.

---

## Summary

| Service  | Agent access | How                                            | How to revoke                          |
|----------|--------------|------------------------------------------------|----------------------------------------|
| GitHub   | Direct       | Windows Credential Manager (your saved login) | Delete credential, or rotate password  |
| Supabase | Direct       | `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`    | Rotate key in Supabase dashboard       |
| Resend   | Direct       | `RESEND_API_KEY` in `.env.local`               | Rotate key in Resend dashboard         |
| Vercel   | **None**     | GitHub → Vercel webhook (entirely out of band) | Disconnect repo in Vercel dashboard    |

---

## The trust model in plain English

The AI agent doesn't have its own keys. It has *your* keys — the same ones
you stored on your machine to do development. Anything the agent can do,
you could do yourself by typing the same commands.

Revoking access is just rotating keys (`.env.local` and GitHub) and
disconnecting webhooks (Vercel). There's nothing centralized to "unplug"
because the agent isn't a separate service — it's a process that runs
commands on your computer using your credentials.

The two real risks to be aware of:

1. **The agent will not know about Vercel deploy failures** unless you
   monitor them. Treat "I pushed the fix" as "the code is at GitHub,"
   not "users are seeing the fix."
2. **The agent has read access to every key in `.env.local`**. Includes
   ones it doesn't actively use (Resend, etc.). If you don't want it to
   have access to a specific service, don't put that key in this file.

---

*To verify any of the above, run the commands shown in their respective
sections from the project root. No secrets are printed by any of these
commands — only the names of the keys, the credential helper setting,
and the presence/absence of various files.*
