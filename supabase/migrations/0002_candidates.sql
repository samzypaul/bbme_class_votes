-- ============================================================================
-- Candidates: per-position nominations.
--
-- Previously any class_member could be voted for under any position (the
-- roster was global). This introduces a join table so a class member only
-- becomes votable for a position once an admin nominates them for it --
-- the ballot can then change from batch to batch (election to election, or
-- position to position) without touching the class_members roster itself.
-- ============================================================================

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.positions(id) on delete cascade,
  class_member_id uuid not null references public.class_members(id) on delete restrict,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint candidates_unique_member_per_position unique (position_id, class_member_id)
);

comment on table public.candidates is 'Nominates a class member as a votable candidate for one specific position.';

create index if not exists candidates_position_id_idx on public.candidates (position_id);
create index if not exists candidates_class_member_id_idx on public.candidates (class_member_id);
create index if not exists candidates_active_idx on public.candidates (is_active);

alter table public.candidates enable row level security;

create policy candidates_select_all on public.candidates
  for select to authenticated using (true);

create policy candidates_admin_write on public.candidates
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- votes.candidate_id now points at candidates(id) instead of
-- class_members(id) directly. Safe to swap with no data migration as long as
-- no votes exist yet for this project; if votes already exist this statement
-- will fail loudly (FK violation) rather than silently corrupt data.
-- ----------------------------------------------------------------------------
alter table public.votes drop constraint if exists votes_candidate_id_fkey;
alter table public.votes
  add constraint votes_candidate_id_fkey foreign key (candidate_id)
  references public.candidates(id) on delete restrict;

-- ----------------------------------------------------------------------------
-- enforce_vote_rules(): now also checks the candidate is actually nominated
-- for the position being voted on (not just any active class member).
-- ----------------------------------------------------------------------------
create or replace function public.enforce_vote_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_election public.elections%rowtype;
  v_position public.positions%rowtype;
  v_candidate public.candidates%rowtype;
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

  select * into v_candidate from public.candidates where id = new.candidate_id;
  if not found or not v_candidate.is_active or v_candidate.position_id <> new.position_id then
    raise exception 'Selected candidate is not a nominee for this position';
  end if;

  if new.voter_id <> auth.uid() then
    raise exception 'Cannot cast a vote on behalf of another member';
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- get_position_results(): tally through candidates -> class_members, and
-- left-join votes so nominees with zero votes still appear in results
-- (the previous version, joining directly from votes, silently omitted any
-- candidate who received no votes at all).
-- ----------------------------------------------------------------------------
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
  select c.id, cm.full_name, count(v.id)
  from public.candidates c
  join public.class_members cm on cm.id = c.class_member_id
  left join public.votes v on v.candidate_id = c.id
  where c.position_id = p_position_id
  group by c.id, cm.full_name
  order by count(v.id) desc, cm.full_name asc;
$$;
