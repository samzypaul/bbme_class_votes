-- Seed data for the MUBAS Biomedical Engineering Class of 2025 Welfare Board
-- Election. Run this once after applying migrations.
--
-- IMPORTANT: the class_members rows below are PLACEHOLDERS. Replace them with
-- your real 2025 class list before opening the election to real voters (see
-- README.md "Adding your real class members").

-- ----------------------------------------------------------------------------
-- 1. Election
-- ----------------------------------------------------------------------------
insert into public.elections (id, name, description, start_at, end_at, status)
values (
  '00000000-0000-0000-0000-000000000001',
  'MUBAS Biomedical Engineering Class of 2025 Welfare Board Election',
  'Election of representatives to the Class of 2025 Welfare Board.',
  now() + interval '1 day',
  now() + interval '4 days',
  'draft'
)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Positions
-- ----------------------------------------------------------------------------
insert into public.positions (election_id, name, description, display_order, is_active)
values
  ('00000000-0000-0000-0000-000000000001', 'President', 'Leads and coordinates the welfare board.', 1, true),
  ('00000000-0000-0000-0000-000000000001', 'Vice President', 'Supports the president and coordinates activities.', 2, true),
  ('00000000-0000-0000-0000-000000000001', 'Secretary', 'Handles records and official communication.', 3, true),
  ('00000000-0000-0000-0000-000000000001', 'Treasurer', 'Oversees welfare board financial records.', 4, true),
  ('00000000-0000-0000-0000-000000000001', 'Welfare Officer', 'Coordinates member welfare activities.', 5, true),
  ('00000000-0000-0000-0000-000000000001', 'Publicity Officer', 'Manages class communications and publicity.', 6, true)
on conflict (election_id, name) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Class members / candidates (PLACEHOLDERS -- replace with the real roster)
-- ----------------------------------------------------------------------------
insert into public.class_members (full_name, department, graduation_year)
values
  ('John Banda', 'Biomedical Engineering', 2025),
  ('Mary Phiri', 'Biomedical Engineering', 2025),
  ('Peter Chirwa', 'Biomedical Engineering', 2025),
  ('Grace Mbewe', 'Biomedical Engineering', 2025),
  ('David Zulu', 'Biomedical Engineering', 2025),
  ('Chisomo Kachale', 'Biomedical Engineering', 2025),
  ('Blessings Nyirenda', 'Biomedical Engineering', 2025),
  ('Tadala Mvula', 'Biomedical Engineering', 2025),
  ('Yamikani Chunga', 'Biomedical Engineering', 2025),
  ('Precious Gondwe', 'Biomedical Engineering', 2025)
on conflict (full_name, graduation_year) do nothing;

-- ----------------------------------------------------------------------------
-- 4. Candidates (PLACEHOLDER -- nominates every placeholder member for every
-- placeholder position; replace with real per-position nominations before
-- opening the election to real voters, via Admin -> Positions).
-- ----------------------------------------------------------------------------
insert into public.candidates (position_id, class_member_id)
select p.id, cm.id
from public.positions p
cross join public.class_members cm
where p.election_id = '00000000-0000-0000-0000-000000000001'
on conflict (position_id, class_member_id) do nothing;
