# MUBAS Biomedical Engineering &middot; Class of 2025 Welfare Board Election

A production-ready voting platform for the MUBAS Biomedical Engineering Class of 2025 Welfare
Board election: no-signup voting with candidate autocomplete and one-vote-per-position
enforcement, an admin portal (the only part that requires an account) for managing the
election/positions/roster, deterministic server-side vote counting, and Gemini-generated result
summaries.

**Voters never create an account.** Visiting `/vote` transparently starts an anonymous Supabase
Auth session (a browser cookie) the first time -- see "Anonymous voting" below for exactly what
that does and does not protect against. Only administrators sign in, at `/login`.

Built with Next.js (App Router) + TypeScript, Tailwind CSS, Supabase (Postgres + Auth + Row Level
Security), Zod, React Hook Form, Recharts, and the Google Gemini API.

## 1. Install & run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The app will show empty/loading states until you connect a real
Supabase project (step 2) and add a `.env.local` (step 4).

## 2. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings &rarr; API**, copy the **Project URL**, **anon public key**, and
   **service_role key**.
3. In **Authentication &rarr; Settings**, turn **on "Allow anonymous sign-ins"**. This is
   required -- without it, `/vote` cannot start a voting session for anyone and will show
   "We couldn't start your voting session."
4. For the admin account(s) only, you can leave "Confirm email" on (recommended) or turn it off
   for faster local testing.

## 3. Run the database migration and seed data

Using the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This applies [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), which
creates every table, index, RLS policy, and the trigger/function layer that enforces one-vote-per-
position server-side.

Then seed placeholder data (an election, six positions, and 10 placeholder class members):

```bash
psql "<your-connection-string>" -f supabase/seed.sql
```

Or paste the contents of `supabase/migrations/0001_init.sql` and then `supabase/seed.sql` into the
Supabase Dashboard's **SQL Editor** and run them in that order.

## 4. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the values from step 2:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
ADMIN_EMAIL=...
```

`SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` are server-only secrets -- they are never sent to
the browser and must never be committed. `.gitignore` already excludes every `.env*` file except
`.env.example`.

## 5. Configure Gemini

1. Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Set `GEMINI_API_KEY` in `.env.local`.
3. The app uses `gemini-2.5-flash` by default (`lib/ai/gemini.ts`). Override with `GEMINI_MODEL` in
   your env if your Google Cloud project has quota for a different model. Gemini is only used to
   phrase a summary of vote counts that are already computed deterministically in Postgres -- it
   never determines a winner. If the Gemini call fails for any reason, official results and vote
   counts are unaffected; the UI shows "the AI summary could not be generated right now."

## 6. Create the first admin

`/register` is not linked anywhere on the public site (voters never see it) -- it exists solely
for administrators to create a login. Go to `/register` directly, create an account, then promote
it in the Supabase SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'your-email@example.com';
```

Log in at `/login` (also reachable via the small "Board Admin Login" link in the site footer) and
an **Admin** link will appear in the header, with `/admin` now reachable. Admin authorization is
enforced server-side (in `proxy.ts` and `lib/auth/helpers.ts`'s `requireAdmin()`), not just hidden
in the UI.

## 7. Add your real class members

Replace the placeholder rows from `supabase/seed.sql` in **Admin &rarr; Class Members**:

- Delete/disable the placeholder names, or
- Use **Import CSV** with a file shaped like:

  ```csv
  full_name,department,graduation_year
  John Banda,Biomedical Engineering,2025
  Mary Phiri,Biomedical Engineering,2025
  ```

  Duplicate names (matched by name + graduation year, case-insensitive) are skipped automatically
  and reported back to you.

## 8. Run the election

1. **Admin &rarr; Elections**: create the election with a name, description, and voting
   start/end date-time. Leave status as `Draft` until you're ready.
2. **Admin &rarr; Positions**: add/edit/reorder/enable/disable the positions members will vote for
   (President, Vice President, Secretary, Treasurer, Welfare Officer, Publicity Officer, ...).
3. When ready, edit the election and set status to `Open`. Members can now vote at `/vote`.
4. When voting ends, edit the election and set status to `Closed`. Results become visible at
   `/results` for everyone, including winners, top-5 charts, and ties.
5. **Admin &rarr; Results**: click **Generate AI Summary** per position. Summaries are cached in
   the `ai_summaries` table -- click **Regenerate Summary** to refresh one.

## Anonymous voting -- what it does and doesn't protect against

This was a deliberate choice to keep voting frictionless: no email, no password, no verification
code. Under the hood, `proxy.ts` calls Supabase's `signInAnonymously()` on a voter's first visit,
which issues a real `auth.uid()` backed by a session cookie. That real `auth.uid()` is what the
`UNIQUE(election_id, position_id, voter_id)` constraint and the vote-validation trigger key off of
-- so within one browser session, the one-vote-per-position rule is enforced exactly as robustly
as it would be for a logged-in user.

What this does **not** protect against: clearing cookies, using a different browser, or opening a
private/incognito window starts a brand-new anonymous session, which can vote again. There is no
way to link two anonymous sessions back to the same person. If your class needs a harder guarantee
against repeat voting, the two straightforward upgrades are (a) go back to real email/password
accounts (the original design this was simplified from), or (b) issue each class member a one-time
access code (e.g. via CSV alongside `class_members`) that's checked and marked used on submission.
Both are larger changes than this iteration -- ask if you want either implemented.

## Database schema

See [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) for the full DDL.
Summary:

| Table | Purpose |
| --- | --- |
| `profiles` | One row per Supabase Auth user, including anonymous voter sessions (nickname/email are null for those). `role='admin'` gates the admin portal. |
| `class_members` | Pre-seeded roster of candidates. `full_name`/`graduation_year` is unique to prevent duplicate imports. |
| `elections` | Name, description, voting window, status (`draft`/`open`/`closed`). |
| `positions` | Belongs to an election; name, description, display order, active flag. |
| `votes` | One row per (election, position, voter). `UNIQUE(election_id, position_id, voter_id)` plus a `BEFORE INSERT` trigger re-validates the election is open, the position is active, and the candidate is valid. Votes cannot be updated or deleted (enforced by trigger). |
| `ai_summaries` | Cached Gemini output per (election, position) so results pages don't call the API on every view. |
| `audit_logs` | Admin actions and vote-casting events (`ADMIN_CREATED_ELECTION`, `USER_CAST_VOTE`, `ADMIN_CLOSED_ELECTION`, `AI_SUMMARY_GENERATED`, ...). |

Row Level Security is enabled on every table. Members can only read their own profile and their
own votes; nobody but an admin (checked via a `SECURITY DEFINER` `is_admin()` function) can read
another member's votes, write to `elections`/`positions`/`class_members`, or see the audit log.
Vote tallies are computed with `get_position_results()`, a `SECURITY DEFINER` SQL function -- the
client never receives raw vote rows for other users, only aggregated counts.

## Security notes

- **No client-trusted counts.** All vote tallying happens in Postgres (`get_position_results`).
  The client only ever submits `{position_id, candidate_id}` pairs.
- **Server-side vote validation.** `app/actions/votes.ts` re-checks the election window, position
  activity, candidate validity, and one-vote-per-position on every submission using fresh
  server-side data, independent of anything the client claims.
- **Database-level backstop.** Even if the server action were bypassed, the `votes_enforce_rules`
  trigger and the `UNIQUE(election_id, position_id, voter_id)` constraint make an invalid or
  duplicate vote impossible to insert.
- **Admin authorization is server-side.** `proxy.ts` blocks unauthenticated/non-admin requests to
  `/admin/**` before they reach a page, and `requireAdmin()` re-checks on every admin Server
  Component/Server Action. Nothing relies on `localStorage` or hiding UI.
- **Immutable votes.** Triggers reject any `UPDATE`/`DELETE` on `votes` for any role except the
  service role, which the app never uses to touch votes.
- **Anonymous voter sessions are still real Supabase Auth users.** They get a genuine `auth.uid()`
  via `signInAnonymously()`, so every RLS policy and the vote-uniqueness constraint apply to them
  exactly as they would to a logged-in user -- see "Anonymous voting" above for the one thing this
  approach intentionally trades away (cross-session identity).

## Project structure

```
app/                    Routes (App Router)
  actions/              Server Actions (auth, votes, admin CRUD, AI summaries)
  admin/                Admin portal (dashboard, elections, positions, members, results)
  login/ register/      Admin-only sign-in/sign-up (never linked from the public site)
  vote/ results/        Public voting + results (no account needed)
components/
  ui/                   Design-system primitives (button, card, dialog, ...)
  election/ voting/ results/ admin/   Feature components
lib/
  supabase/             Browser/server/admin Supabase clients + proxy (anonymous sign-in + admin gate)
  ai/gemini.ts          Server-only Gemini integration
  auth/helpers.ts       getCurrentProfile() / requireAdmin() server-side guards
  voting/               Candidate fuzzy-matching + shared data queries
  validation/schemas.ts Zod schemas
types/database.ts       Hand-written Supabase types matching the migration
supabase/
  migrations/0001_init.sql   Schema, RLS, triggers, functions
  seed.sql                   Placeholder election/positions/class members
```

## Testing checklist

Manually verified: voting with no account (anonymous session created transparently), voting for
multiple positions in one submission, rejecting a duplicate vote within the same session, voting
while draft/closed, admin login/logout, invalid admin credentials, duplicate admin nickname/email,
admin-only access to `/admin`, election/position/member CRUD, CSV import with duplicate detection,
results hidden while open and shown after close, tie handling, zero-vote positions, and Gemini
failure falling back to a friendly message without blocking official results.

## Deploying to Vercel

1. Push this repository to GitHub/GitLab/Bitbucket.
2. In Vercel, **Import Project** and select the repo.
3. Add the environment variables from `.env.example` (with your real values) in
   **Project Settings &rarr; Environment Variables**.
4. Deploy. Vercel builds with `next build` and serves the App Router output automatically.
5. Set `NEXT_PUBLIC_APP_URL` to your production URL for correctness in metadata/links.

## Branding

`components/election/logo.tsx` renders a text-based "M" emblem in place of an official MUBAS
logo image, since no logo asset was supplied. To use a real logo, drop it at
`public/images/mubas-logo.png` and swap the `MubasMark` component for a Next.js `<Image>` tag.
