-- Extend Game of Skate live match flow to support invitations

alter table public.gos_match
  drop constraint if exists gos_match_status_check;

alter table public.gos_match
  alter column status drop default;

alter table public.gos_match
  add constraint gos_match_status_check
    check (status in ('pending', 'active', 'ended', 'cancelled'));

alter table public.gos_match
  alter column status set default 'pending';

alter table public.gos_match
  add column if not exists accepted_at timestamptz;

alter table public.gos_match
  add column if not exists cancelled_at timestamptz;

-- Ensure existing matches remain valid by setting status to active when needed
update public.gos_match
  set status = 'active'
  where status not in ('active', 'ended', 'cancelled');
