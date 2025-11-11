-- Align community events gamification
-- 1) Relax the event_type constraint applied by the initial table migration.
-- 2) Auto-award the "Organisateur" badge when a user creates their first community event.

alter table if exists public.community_events
  drop constraint if exists community_events_event_type_check;

alter table if exists public.community_events
  add constraint community_events_event_type_check
    check (char_length(btrim(event_type)) > 0);

create or replace function public.award_organizer_badge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_badge_id uuid;
begin
  if new.created_by is null then
    return new;
  end if;

  select id
    into v_badge_id
  from public.badges
  where name ilike 'Organisateur'
  limit 1;

  if v_badge_id is null then
    -- Badge not seeded yet, skip quietly
    return new;
  end if;

  insert into public.user_badges (user_id, badge_id, earned_at, is_displayed)
  select new.created_by, v_badge_id, coalesce(new.created_at, now()), true
  where not exists (
    select 1
    from public.user_badges
    where user_id = new.created_by
      and badge_id = v_badge_id
  );

  return new;
end;
$$;

drop trigger if exists trg_community_events_award_badge on public.community_events;

create trigger trg_community_events_award_badge
after insert on public.community_events
for each row
execute function public.award_organizer_badge();

-- Backfill the organizer badge for existing creators
with creators as (
  select distinct created_by
  from public.community_events
  where created_by is not null
),
target_badge as (
  select id
  from public.badges
  where name ilike 'Organisateur'
  limit 1
)
insert into public.user_badges (user_id, badge_id, earned_at, is_displayed)
select c.created_by, tb.id, now(), true
from creators c
cross join target_badge tb
where not exists (
  select 1
  from public.user_badges ub
  where ub.user_id = c.created_by
    and ub.badge_id = tb.id
);
