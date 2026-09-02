-- ============================================================================
-- Archives a position's results whenever an admin resets its votes, so the
-- prior poll isn't lost -- visible only in the admin panel (public results
-- only ever show the live, current tally).
-- ============================================================================

create table if not exists public.position_result_history (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete cascade,
  position_name text not null,
  results jsonb not null,
  total_votes int not null,
  reset_by uuid references auth.users(id) on delete set null,
  reset_at timestamptz not null default now()
);

comment on table public.position_result_history is 'Snapshot of a position''s results taken right before an admin reset its votes.';

create index if not exists position_result_history_position_id_idx on public.position_result_history (position_id);
create index if not exists position_result_history_election_id_idx on public.position_result_history (election_id);

alter table public.position_result_history enable row level security;

-- Admin-only, both to read and to write (writes happen via the service-role
-- client inside resetPositionVotes; this policy governs the read side that
-- Admin -> Results uses with the signed-in admin's own session).
create policy position_result_history_admin_all on public.position_result_history
  for all using (public.is_admin()) with check (public.is_admin());
