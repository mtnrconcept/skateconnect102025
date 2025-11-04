-- Link Game of S.K.A.T.E realtime matches to skate_matches for easier joins

alter table public.gos_match
  add column if not exists skate_match_id uuid;

create unique index if not exists gos_match_skate_match_id_idx
  on public.gos_match(skate_match_id)
  where skate_match_id is not null;
