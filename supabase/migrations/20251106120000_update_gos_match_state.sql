-- Extend gos_match with phase management for live self-referee logic
alter table public.gos_match
  add column if not exists round_number int not null default 1 check (round_number >= 1);

alter table public.gos_match
  add column if not exists phase text not null default 'set_idle' check (phase in (
    'set_idle',
    'set_attempting',
    'copy_idle',
    'copy_attempting',
    'confirm',
    'dispute'
  ));

alter table public.gos_match
  add column if not exists phase_payload jsonb not null default '{}'::jsonb;

alter table public.gos_match
  add column if not exists current_trick text;

alter table public.gos_match
  add column if not exists timer_expires_at timestamptz;

alter table public.gos_match
  add column if not exists timer_for text check (timer_for in ('A','B'));

alter table public.gos_match
  add column if not exists last_try_a_used boolean not null default false;

alter table public.gos_match
  add column if not exists last_try_b_used boolean not null default false;

alter table public.gos_match
  add column if not exists contest_a_count int not null default 0 check (contest_a_count >= 0);

alter table public.gos_match
  add column if not exists contest_b_count int not null default 0 check (contest_b_count >= 0);
