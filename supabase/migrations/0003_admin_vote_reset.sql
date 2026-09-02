-- ============================================================================
-- Allow a single, audited admin path to delete votes: resetting an entire
-- position's votes (e.g. after a mistake) so members can revote. Votes stay
-- immutable for everyone else -- this only opens the door for the
-- service-role connection used exclusively by the resetPositionVotes server
-- action (see app/actions/admin.ts), which requireAdmin()-gates the caller
-- and writes an audit_logs entry before deleting.
-- ============================================================================

create or replace function public.block_vote_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and auth.role() = 'service_role' then
    return old;
  end if;
  raise exception 'Votes cannot be modified or deleted';
end;
$$;
