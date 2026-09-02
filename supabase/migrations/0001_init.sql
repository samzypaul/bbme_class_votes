-- MUBAS Biomedical Engineering Class of 2025 Welfare Board Election Platform
-- Initial schema, constraints, indexes, RLS policies, and business-rule triggers.

create extension if not exists "pgcrypto";

-- ============================================================================
-- TABLES
-- ============================================================================

-- One row per Supabase Auth user, keyed to auth.users.id (Supabase Auth is
-- the single source of truth for identity; this table only adds app data).
--
-- Regular voters never sign up: proxy.ts transparently calls
-- auth.signInAnonymously() on their first visit so they get a real
-- Supabase-issued session (and therefore a real auth.uid() for RLS and the
-- one-vote-per-position constraint on `votes`) without ever seeing a
-- registration form. Anonymous voters have no email/nickname, hence both
-- columns are nullable. Only admins go through actual email/password sign-up
-- (see /register, gated behind /login and never linked from the public site)
-- and are promoted to role='admin' manually -- see README.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nickname text,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'App-level profile data for each Supabase Auth user, including anonymous voter sessions.';

-- Pre-seeded roster of graduating class members who may be voted for.
create table if not exists public.class_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  department text not null default 'Biomedical Engineering',
  graduation_year int not null default 2025,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint class_members_unique_name unique (full_name, graduation_year)
);

create table if not exists public.elections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  created_at timestamptz not null default now(),
  constraint elections_valid_window check (end_at > start_at)
);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  name text not null,
  description text,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint positions_unique_name_per_election unique (election_id, name)
);

-- The one true record of a cast vote. Immutable once written (no UPDATE/DELETE
-- policy is granted to anyone but the service role) and constrained so a voter
-- cannot cast more than one vote per position.
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  candidate_id uuid not null references public.class_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint votes_one_per_position unique (election_id, position_id, voter_id)
);

create table if not exists public.ai_summaries (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete cascade,
  summary text not null,
  winner_name text,
  winner_votes int,
  winner_percentage numeric,
  is_tie boolean not null default false,
  generated_at timestamptz not null default now(),
  constraint ai_summaries_unique_position unique (election_id, position_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

create unique index if not exists profiles_nickname_key on public.profiles (lower(nickname)) where nickname is not null;
create index if not exists class_members_full_name_idx on public.class_members using gin (to_tsvector('simple', full_name));
create index if not exists class_members_active_idx on public.class_members (is_active);
create index if not exists positions_election_id_idx on public.positions (election_id);
create index if not exists positions_active_idx on public.positions (is_active);
create index if not exists votes_election_id_idx on public.votes (election_id);
create index if not exists votes_position_id_idx on public.votes (position_id);
create index if not exists votes_candidate_id_idx on public.votes (candidate_id);
create index if not exists votes_voter_id_idx on public.votes (voter_id);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Creates a profile row automatically for every new Supabase Auth user,
-- including anonymous voter sessions (which have no email and no metadata --
-- both columns are simply left null for those). Real sign-ups (admins) pass
-- their nickname through raw_user_meta_data at signUp() time.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nickname)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'nickname'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Server-side defense-in-depth for the voting business rules. RLS + the
-- application layer already enforce these, but a DB trigger guarantees the
-- rule holds even against a compromised client or a direct SQL connection.
create or replace function public.enforce_vote_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_election public.elections%rowtype;
  v_position public.positions%rowtype;
  v_candidate public.class_members%rowtype;
begin
  select * into v_election from public.elections where id = new.election_id;
  if not found then
    raise exception 'Election does not exist';
  end if;

  if v_election.status <> 'open' then
    raise exception 'Voting is not open for this election';
  end if;

  if now() < v_election.start_at or now() > v_election.end_at then
    raise exception 'Voting is outside the configured election window';
  end if;

  select * into v_position from public.positions where id = new.position_id;
  if not found or v_position.election_id <> new.election_id then
    raise exception 'Position does not belong to this election';
  end if;

  if not v_position.is_active then
    raise exception 'This position is not open for voting';
  end if;

  select * into v_candidate from public.class_members where id = new.candidate_id;
  if not found or not v_candidate.is_active then
    raise exception 'Selected candidate is not a valid class member';
  end if;

  if new.voter_id <> auth.uid() then
    raise exception 'Cannot cast a vote on behalf of another member';
  end if;

  return new;
end;
$$;

drop trigger if exists votes_enforce_rules on public.votes;
create trigger votes_enforce_rules
  before insert on public.votes
  for each row execute function public.enforce_vote_rules();

-- Votes are immutable: block UPDATE/DELETE outright (belt-and-braces on top
-- of RLS granting no such policies to authenticated users).
create or replace function public.block_vote_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Votes cannot be modified or deleted';
end;
$$;

drop trigger if exists votes_block_update on public.votes;
create trigger votes_block_update
  before update on public.votes
  for each row execute function public.block_vote_mutation();

drop trigger if exists votes_block_delete on public.votes;
create trigger votes_block_delete
  before delete on public.votes
  for each row execute function public.block_vote_mutation();

-- Deterministic, server-computed vote tallies. Never trust a client-supplied
-- count; this is the only source of truth for results.
create or replace function public.get_position_results(p_position_id uuid)
returns table (
  candidate_id uuid,
  candidate_name text,
  vote_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select cm.id, cm.full_name, count(v.id)
  from public.votes v
  join public.class_members cm on cm.id = v.candidate_id
  where v.position_id = p_position_id
  group by cm.id, cm.full_name
  order by count(v.id) desc, cm.full_name asc;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.class_members enable row level security;
alter table public.elections enable row level security;
alter table public.positions enable row level security;
alter table public.votes enable row level security;
alter table public.ai_summaries enable row level security;
alter table public.audit_logs enable row level security;

-- profiles: members read only their own row; admins read all. Nobody but the
-- owning user may update their row, and only the nickname is meant to change.
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- class_members: any authenticated member can browse the roster (needed for
-- candidate autocomplete); only admins may write.
create policy class_members_select_all on public.class_members
  for select to authenticated using (true);

create policy class_members_admin_write on public.class_members
  for all using (public.is_admin()) with check (public.is_admin());

-- elections: readable by any authenticated member; only admins manage them.
create policy elections_select_all on public.elections
  for select to authenticated using (true);

create policy elections_admin_write on public.elections
  for all using (public.is_admin()) with check (public.is_admin());

-- positions: readable by any authenticated member; only admins manage them.
create policy positions_select_all on public.positions
  for select to authenticated using (true);

create policy positions_admin_write on public.positions
  for all using (public.is_admin()) with check (public.is_admin());

-- votes: a member may insert only their own vote and may read only their own
-- votes (so nobody can see how anyone else voted). Admins may read all votes
-- for tallying/results. No UPDATE/DELETE policy exists for anyone but the
-- service role, which bypasses RLS entirely -- application code never uses it
-- to mutate votes.
create policy votes_insert_own on public.votes
  for insert to authenticated with check (voter_id = auth.uid());

create policy votes_select_own on public.votes
  for select to authenticated using (voter_id = auth.uid() or public.is_admin());

-- ai_summaries: visible to everyone once generated (results are public after
-- close); only admins can write them.
create policy ai_summaries_select_all on public.ai_summaries
  for select to authenticated using (true);

create policy ai_summaries_admin_write on public.ai_summaries
  for all using (public.is_admin()) with check (public.is_admin());

-- audit_logs: admin-only visibility. Rows are written by server actions using
-- the service role (bypasses RLS) or by admins directly.
create policy audit_logs_admin_select on public.audit_logs
  for select using (public.is_admin());

create policy audit_logs_admin_insert on public.audit_logs
  for insert with check (public.is_admin());
